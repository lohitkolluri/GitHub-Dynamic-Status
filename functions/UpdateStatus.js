// Import required modules
import axios from 'axios';
import dotenv from 'dotenv';
import EventEmitter from 'events';
import { GitHubProfileStatus } from 'github-profile-status';

dotenv.config();

const DEFAULT_CONFIG = {
    updateInterval: 15 * 60 * 1000, // 15 minutes
    maxStatusLength: 80,
    progressBarLength: 20, // Adjusted for better visibility
    retryAttempts: 3,
    baseURL: 'https://wakatime.com/api/v1',
    debug: process.env.NODE_ENV === 'dev',
    activityWindow: 300 // 5 minutes in seconds
};

class WakaTimeStatus extends EventEmitter {
    constructor(config = {}) {
        super();
        this.validateEnvironment();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.debug = this.config.debug;
        this.lastActiveProject = null;

        this.githubStatus = new GitHubProfileStatus({
            token: process.env.GITHUB_TOKEN
        });

        this.wakatimeApiKey = process.env.WAKATIME_API_KEY;

        this.api = axios.create({
            baseURL: this.config.baseURL,
            headers: {
                'Authorization': `Basic ${Buffer.from(this.wakatimeApiKey).toString('base64')}`,
                'Content-Type': 'application/json'
            }
        });
    }

    validateEnvironment() {
        const requiredEnvVars = {
            'WAKATIME_API_KEY': process.env.WAKATIME_API_KEY,
            'GITHUB_TOKEN': process.env.GITHUB_TOKEN
        };

        const missingVars = Object.entries(requiredEnvVars)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }
    }

    log(...args) {
        if (this.debug) {
            console.log(new Date().toISOString(), ...args);
        }
    }

    formatTime(seconds) {
        if (!seconds) return '0m';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    createProgressBar(current, total) {
        const { progressFilled, progressEmpty } = this.getStatusConfig();
        const progress = Math.min(current / total, 1);
        const filledLength = Math.round(progress * this.config.progressBarLength);
        const emptyLength = this.config.progressBarLength - filledLength;

        return `${progressFilled.repeat(filledLength)}${progressEmpty.repeat(emptyLength)}`;
    }

    getStatusConfig() {
        return {
            progressFilled: '⬢',
            progressEmpty: '⬡',
            timeIcon: '⏳',
            projectIcon: '📁',
            codingIcon: '💻',
            idleIcon: '🌙',
            errorIcon: '⚠️',
            separator: '⟫'
        };
    }

    async getWakaTimeData() {
        const maxRetries = this.config.retryAttempts;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                this.log('Fetching WakaTime data...');
                const [userResponse, statusResponse] = await Promise.all([
                    this.api.get('/users/current'),
                    this.api.get('/users/current/status_bar/today')
                ]);

                const statusData = statusResponse.data.data;
                const userData = userResponse.data.data;

                const currentProject = statusData.project || userData.last_project;
                const currentLanguage = statusData.language || userData.last_language;
                const lastHeartbeat = statusData.heartbeat_at ? new Date(statusData.heartbeat_at) : null;
                const now = new Date();

                const timeDifference = lastHeartbeat ? (now - lastHeartbeat) / 1000 : Infinity;
                const isCoding = lastHeartbeat && timeDifference <= this.config.activityWindow;

                this.lastActiveProject = {
                    name: currentProject,
                    language: currentLanguage
                };

                const languages = statusData.languages || userData.languages;
                const filteredLanguages = languages.filter(lang => lang.name !== 'Other');
                const mostUsedLanguage = filteredLanguages.length > 0
                    ? filteredLanguages.reduce((prev, current) => (prev.total_seconds > current.total_seconds) ? prev : current).name
                    : null;

                const data = {
                    currentProject: currentProject || 'No active project',
                    currentLanguage: currentLanguage || 'No language detected',
                    totalSeconds: statusData.grand_total?.total_seconds || 0,
                    isCoding: isCoding,
                    mostUsedLanguage: mostUsedLanguage,
                    lastProject: this.lastActiveProject,
                    lastHeartbeat: lastHeartbeat
                };

                this.log('Processed WakaTime data:', data);
                this.emit('dataFetched', data);
                return data;

            } catch (error) {
                this.log('WakaTime API Error:', error);
                if (error.response?.status === 429) {
                    const backoffTime = Math.pow(2, retryCount) * 1000;
                    this.log(`Rate limit hit, backing off for ${backoffTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffTime));
                    retryCount++;
                    continue;
                }

                this.emit('error', error);
                return null;
            }
        }
        return null;
    }

    async updateStatus() {
        try {
            const wakaTimeData = await this.getWakaTimeData();
            if (!wakaTimeData) {
                await this.githubStatus.update({
                    emoji: '🌟',
                    message: 'Status temporarily unavailable'
                });
                this.emit('statusUpdateFailed');
                return false;
            }

            const config = this.getStatusConfig();
            const progressBar = this.createProgressBar(wakaTimeData.totalSeconds, 5 * 3600);
            const progressPercentage = Math.min(Math.round((wakaTimeData.totalSeconds / (5 * 3600)) * 100), 100);

            const message = `${config.timeIcon} ${this.formatTime(wakaTimeData.totalSeconds)} ${config.separator} ${config.projectIcon} ${wakaTimeData.currentProject} ${config.separator} ${progressBar} ${progressPercentage}% ${config.separator} ${wakaTimeData.mostUsedLanguage || 'No language'}`;

            await this.githubStatus.update({
                emoji: wakaTimeData.isCoding ? '🚀' : '💻',
                message
            });

            this.log('Updated GitHub status:', message);
            this.emit('statusUpdated', { emoji: wakaTimeData.isCoding ? '🚀' : '💻', message });
            return true;
        } catch (error) {
            this.log('Error updating status:', error);
            this.emit('error', error);
            return false;
        }
    }
}

export async function handler(event, context) {
    try {
        const config = {
            updateInterval: 15 * 60 * 1000, // 15 minutes
            maxStatusLength: 80,
            progressBarLength: 10, // Adjusted for better visibility
            debug: true,
            activityWindow: 300, // Matches broader activity tracking window
        };

        const statusUpdater = new WakaTimeStatus(config);
        const success = await statusUpdater.updateStatus();

        if (success) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'GitHub status updated successfully.' }),
            };
        } else {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to update GitHub status.' }),
            };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
}
