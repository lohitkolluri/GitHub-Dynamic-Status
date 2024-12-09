import axios from 'axios';
import dotenv from 'dotenv';
import EventEmitter from 'events';
import { GitHubProfileStatus } from 'github-profile-status';

dotenv.config();

const DEFAULT_CONFIG = {
    updateInterval: 5 * 60 * 1000,
    maxStatusLength: 80,
    progressBarLength: 10,
    retryAttempts: 3,
    baseURL: 'https://wakatime.com/api/v1',
    debug: false,
    activityWindow: 5 * 60 // 5 minutes in seconds
};

class WakaTimeStatus extends EventEmitter {
    constructor(config = {}) {
        super();
        this.validateEnvironment();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.debug = this.config.debug;
        this.updateInterval = null;
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
            return `${hours}h${minutes}m`;
        }
        return `${minutes}m`;
    }

    getStatusConfig() {
        return {
            progressFilled: '⬢',
            progressEmpty: '⬡',
            timeIcon: '⏰',
            projectIcon: '📂',
            codingIcon: '⚡',
            idleIcon: '💫',
            errorIcon: '⚠️',
            separator: ' ⟫ '
        };
    }

    getAnimatedEmoji(baseEmoji, style = this.config.animationStyle) {
        const animations = {
            pulse: ['⎯', '\\', '|', '/'],
            wave: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
            rotate: ['◜', '◝', '◞', '◟'],
            none: ['']
        };

        if (!this.config.useAnimatedIcons || style === 'none') {
            return baseEmoji;
        }

        const animationFrames = animations[style] || animations.none;
        const frame = Math.floor(Date.now() / 250) % animationFrames.length;
        return animationFrames[frame] + baseEmoji;
    }

    createProgressBar(percentage, length = this.config.progressBarLength) {
        const config = this.getStatusConfig();
        const filled = Math.round(percentage * length / 100);
        const empty = length - filled;

        let progressBar = config.progressFilled.repeat(filled);
        progressBar += config.progressEmpty.repeat(empty);

        if (this.config.useAnimatedIcons && percentage < 100 && filled < length) {
            const pulseChar = config.progressFilled;
            progressBar = progressBar.slice(0, -1) + pulseChar;
        }

        return progressBar;
    }

    truncateString(str, maxLength) {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
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

                // Fetch most used language for the day
                const languages = statusData.languages || userData.languages;
                const filteredLanguages = languages.filter(lang => lang.name !== 'Other'); // Filter out 'Other' language
                const mostUsedLanguage = filteredLanguages.length > 0
                    ? filteredLanguages.reduce((prev, current) => (prev.total_seconds > current.total_seconds) ? prev : current).name
                    : null;

                const data = {
                    currentProject: currentProject || null,
                    currentLanguage: currentLanguage || '',
                    totalSeconds: statusData.grand_total?.total_seconds || 0,
                    isCoding: isCoding,
                    mostUsedLanguage: mostUsedLanguage, // New field for most used language
                    lastProject: this.lastActiveProject,
                    lastHeartbeat: lastHeartbeat
                };

                this.log('Processed WakaTime data with custom logic:', data);
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

    createDynamicStatus(wakaTimeData) {
        this.log('Creating status with data:', wakaTimeData);
        const config = this.getStatusConfig();

        if (!wakaTimeData) {
            return {
                emoji: this.getAnimatedEmoji(config.errorIcon),
                message: 'Status unavailable'
            };
        }

        const statusParts = [];
        const totalTime = this.formatTime(wakaTimeData.totalSeconds);
        const timeIcon = this.getAnimatedEmoji(config.timeIcon, wakaTimeData.isCoding ? 'pulse' : 'none');
        statusParts.push(`${timeIcon} ${totalTime}`);

        const projectName = wakaTimeData.currentProject ||
            (wakaTimeData.lastProject ? wakaTimeData.lastProject.name : null);
        const language = wakaTimeData.currentLanguage ||
            (wakaTimeData.lastProject ? wakaTimeData.lastProject.language : null);

        if (projectName) {
            const projectIcon = this.getAnimatedEmoji(config.projectIcon, 'none');
            const projectInfo = this.truncateString(projectName, 30);
            statusParts.push(`${projectIcon} ${projectInfo}`);
        }

        const progressPercentage = Math.min((wakaTimeData.totalSeconds / (8 * 3600)) * 100, 100);
        const progressBar = this.createProgressBar(progressPercentage);
        statusParts.push(`${progressBar} ${Math.round(progressPercentage)}%`);

        // Replace activity icon with the Most Used Language of the Day, excluding 'Other'
        const mostUsedLanguage = wakaTimeData.mostUsedLanguage || 'Unknown';
        statusParts.push(`${mostUsedLanguage}`);

        const message = statusParts.join(config.separator);
        this.log('Created status message:', message);

        return {
            emoji: wakaTimeData.isCoding ? '🚀' : '🌟',
            message: message
        };
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

            const status = this.createDynamicStatus(wakaTimeData);
            this.log('Updating GitHub status to:', status);

            await this.githubStatus.update(status);
            this.log('Status updated successfully');
            this.emit('statusUpdated', status);
            return true;
        } catch (error) {
            this.log('Error updating status:', error);
            this.emit('error', error);
            return false;
        }
    }

    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            this.log('Status updater stopped');
            this.emit('stopped');
        }
    }

    async start() {
        this.log('Starting WakaTime status updater...');
        await this.updateStatus();
        this.updateInterval = setInterval(() => this.updateStatus(), this.config.updateInterval);
        this.emit('started');
    }
}

// Usage example
try {
    const config = {
        updateInterval: 5 * 60 * 1000,
        maxStatusLength: 80,
        progressBarLength: 10,
        debug: true
    };

    const statusUpdater = new WakaTimeStatus(config);

    statusUpdater.on('started', () => console.log('Status updater started'));
    statusUpdater.on('stopped', () => console.log('Status updater stopped'));
    statusUpdater.on('statusUpdated', (status) => console.log('Status updated:', status));
    statusUpdater.on('error', (error) => console.error('Error occurred:', error));

    statusUpdater.start();
} catch (error) {
    console.error('Failed to start application:', error.message);
}