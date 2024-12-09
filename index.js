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
    debug: false
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

    createProgressBar(percentage, length = this.config.progressBarLength) {
        const filledChar = '█';
        const emptyChar = '░';
        const filled = Math.round(percentage * length / 100);
        const empty = length - filled;
        return filledChar.repeat(filled) + emptyChar.repeat(empty);
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

                this.log('User data:', userResponse.data);
                this.log('Status data:', statusResponse.data);

                if (statusResponse.status !== 200) {
                    throw new Error(`Status API returned ${statusResponse.status}`);
                }

                const statusData = statusResponse.data.data;
                const userData = userResponse.data.data;

                // Try to get project from multiple sources
                const currentProject = statusData.project || userData.last_project;

                if (currentProject) {
                    this.lastActiveProject = {
                        name: currentProject,
                        language: statusData.language || userData.last_language
                    };
                    this.log('Updated last active project:', this.lastActiveProject);
                }

                const data = {
                    currentProject: currentProject || null,
                    currentLanguage: statusData.language || userData.last_language || '',
                    totalSeconds: statusData.grand_total?.total_seconds || 0,
                    isCoding: statusData.is_coding_activity || false,
                    lastProject: this.lastActiveProject,
                    lastHeartbeat: statusData.heartbeat_at
                };

                this.log('Processed WakaTime data:', data);
                this.emit('dataFetched', data);
                return data;

            } catch (error) {
                this.log('WakaTime API Error:', {
                    message: error.message,
                    response: error.response?.data,
                    status: error.response?.status
                });

                if (error.response?.status === 429) { // Rate limit hit
                    const backoffTime = Math.pow(2, retryCount) * 1000;
                    this.log(`Rate limit hit, backing off for ${backoffTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffTime));
                    retryCount++;
                    continue;
                }

                if (error.response?.status === 402) {
                    this.log('Premium API endpoint detected, falling back to basic endpoints...');
                    // Implement fallback logic here if needed
                }

                this.emit('error', error);
                return null;
            }
        }
        return null;
    }

    createDynamicStatus(wakaTimeData) {
        this.log('Creating status with data:', wakaTimeData);

        if (!wakaTimeData) {
            return {
                emoji: '⚠️',
                message: 'Status unavailable'
            };
        }

        const statusParts = [];

        // Time Spent
        const totalTime = this.formatTime(wakaTimeData.totalSeconds);
        statusParts.push(`⏱️ ${totalTime}`);

        // Project Information
        const projectName = wakaTimeData.currentProject ||
            (wakaTimeData.lastProject ? wakaTimeData.lastProject.name : null);
        const language = wakaTimeData.currentLanguage ||
            (wakaTimeData.lastProject ? wakaTimeData.lastProject.language : null);

        if (projectName) {
            const projectInfo = language ?
                this.truncateString(`${projectName} (${language})`, 30) :
                this.truncateString(projectName, 30);
            statusParts.push(`📁 ${projectInfo}`);
        }

        // Progress Bar (8-hour workday)
        const progressPercentage = Math.min((wakaTimeData.totalSeconds / (8 * 3600)) * 100, 100);
        statusParts.push(`${this.createProgressBar(progressPercentage)} ${Math.round(progressPercentage)}%`);

        const message = statusParts.join(' | ');
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

    async healthCheck() {
        try {
            const response = await this.api.get('/users/current');
            const health = {
                status: 'healthy',
                lastUpdate: new Date(),
                apiStatus: response.status === 200
            };
            this.emit('healthCheck', health);
            return health;
        } catch (error) {
            const health = {
                status: 'unhealthy',
                lastUpdate: new Date(),
                error: error.message
            };
            this.emit('healthCheck', health);
            return health;
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

    // Event listeners
    statusUpdater.on('started', () => console.log('Status updater started'));
    statusUpdater.on('stopped', () => console.log('Status updater stopped'));
    statusUpdater.on('statusUpdated', (status) => console.log('Status updated:', status));
    statusUpdater.on('error', (error) => console.error('Error occurred:', error));
    statusUpdater.on('healthCheck', (health) => console.log('Health check:', health));

    statusUpdater.start();
} catch (error) {
    console.error('Failed to start application:', error.message);
}