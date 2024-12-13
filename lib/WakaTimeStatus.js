// lib/WakaTimeStatus.js
import axios from 'axios';

export class WakaTimeStatus {
    constructor(config = {}) {
        this.validateEnvironment();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.debug = this.config.debug;
        this.lastActiveProject = null;

        this.wakatimeApiKey = process.env.WAKATIME_API_KEY;
        this.githubToken = process.env.GITHUB_TOKEN;

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
        return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
    }

    getAnimatedEmoji(baseEmoji, style = 'none') {
        const animations = {
            pulse: ['⎯', '\\', '|', '/'],
            wave: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
            rotate: ['◜', '◝', '◞', '◟'],
            none: ['']
        };

        if (style === 'none') return baseEmoji;

        const animationFrames = animations[style] || animations.none;
        const frame = Math.floor(Date.now() / 250) % animationFrames.length;
        return animationFrames[frame] + baseEmoji;
    }

    createProgressBar(percentage) {
        const { progressFilled, progressEmpty } = this.config.statusConfig;
        const filled = Math.round(percentage * this.config.progressBarLength / 100);
        const empty = this.config.progressBarLength - filled;

        let progressBar = progressFilled.repeat(filled) + progressEmpty.repeat(empty);

        if (percentage < 100 && filled < this.config.progressBarLength) {
            progressBar = progressBar.slice(0, -1) + progressFilled;
        }

        return progressBar;
    }

    truncateString(str, maxLength) {
        if (!str || str.length <= maxLength) return str || '';
        return str.substring(0, maxLength - 3) + '...';
    }

    async getWakaTimeData() {
        let retryCount = 0;
        while (retryCount < this.config.retryAttempts) {
            try {
                this.log('Fetching WakaTime data...');
                const [userResponse, statusResponse] = await Promise.all([
                    this.api.get('/users/current'),
                    this.api.get('/users/current/status_bar/today')
                ]);

                const statusData = statusResponse.data.data;
                const userData = userResponse.data.data;
                const lastHeartbeat = statusData.heartbeat_at ? new Date(statusData.heartbeat_at) : null;
                const timeDifference = lastHeartbeat ? (new Date() - lastHeartbeat) / 1000 : Infinity;

                const data = {
                    currentProject: statusData.project || userData.last_project,
                    currentLanguage: statusData.language || userData.last_language,
                    totalSeconds: statusData.grand_total?.total_seconds || 0,
                    isCoding: lastHeartbeat && timeDifference <= this.config.activityWindow,
                    mostUsedLanguage: this.getMostUsedLanguage(statusData.languages || userData.languages),
                    lastHeartbeat
                };

                this.log('Processed WakaTime data:', data);
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
                return null;
            }
        }
        return null;
    }

    getMostUsedLanguage(languages = []) {
        const filtered = languages.filter(lang => lang.name !== 'Other');
        return filtered.length > 0
            ? filtered.reduce((prev, curr) => prev.total_seconds > curr.total_seconds ? prev : curr).name
            : null;
    }

    formatProjectName(projectName) {
        if (!projectName) return '';
        return projectName.split('/').pop();
    }

    createDynamicStatus(data) {
        this.log('Creating status with data:', data);
        const config = this.config.statusConfig;

        if (!data) {
            return {
                emoji: this.getAnimatedEmoji(config.errorIcon),
                message: 'Status unavailable'
            };
        }

        const statusParts = [];

        // Time
        const totalTime = this.formatTime(data.totalSeconds);
        const timeIcon = this.getAnimatedEmoji(config.timeIcon, data.isCoding ? 'pulse' : 'none');
        statusParts.push(`${timeIcon} ${totalTime}`);

        // Project
        if (data.currentProject) {
            const projectIcon = this.getAnimatedEmoji(config.projectIcon, 'none');
            const projectInfo = this.truncateString(this.formatProjectName(data.currentProject), 30);
            statusParts.push(`${projectIcon} ${projectInfo}`);
        }

        // Progress
        const progressPercentage = Math.min((data.totalSeconds / (8 * 3600)) * 100, 100);
        const progressBar = this.createProgressBar(progressPercentage);
        statusParts.push(`${progressBar} ${Math.round(progressPercentage)}%`);

        // Language
        if (data.mostUsedLanguage) {
            statusParts.push(data.mostUsedLanguage);
        }

        const message = statusParts.join(config.separator);
        this.log('Created status message:', message);

        return {
            emoji: data.isCoding ? '🚀' : '🌟',
            message
        };
    }

    async updateGithubStatus(status) {
        const response = await fetch('https://api.github.com/user/status', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(status)
        });

        if (!response.ok) {
            throw new Error(`GitHub API Error: ${response.statusText}`);
        }

        return response.json();
    }

    async updateStatus() {
        try {
            const wakaTimeData = await this.getWakaTimeData();
            if (!wakaTimeData) {
                await this.updateGithubStatus({
                    emoji: '🌟',
                    message: 'Status temporarily unavailable'
                });
                return false;
            }

            const status = this.createDynamicStatus(wakaTimeData);
            await this.updateGithubStatus(status);
            this.log('Updated GitHub status:', status);
            return true;
        } catch (error) {
            this.log('Error updating status:', error);
            return false;
        }
    }
}