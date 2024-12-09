//index.js
import axios from 'axios';
import dotenv from 'dotenv';
import { GitHubProfileStatus } from 'github-profile-status';

dotenv.config();

class WakaTimeStatus {
    constructor(config = {}) {
        if (!process.env.WAKATIME_API_KEY) {
            throw new Error('WAKATIME_API_KEY is required in .env file');
        }
        if (!process.env.GITHUB_TOKEN) {
            throw new Error('GITHUB_TOKEN is required in .env file');
        }

        this.githubStatus = new GitHubProfileStatus({
            token: process.env.GITHUB_TOKEN
        });
        this.wakatimeApiKey = process.env.WAKATIME_API_KEY;
        this.updateInterval = config.updateInterval || 5 * 60 * 1000;
        this.maxStatusLength = config.maxStatusLength || 80;
        this.progressBarLength = config.progressBarLength || 10;
        this.lastActiveProject = null;

        this.api = axios.create({
            baseURL: 'https://wakatime.com/api/v1',
            headers: {
                'Authorization': `Basic ${Buffer.from(this.wakatimeApiKey).toString('base64')}`,
                'Content-Type': 'application/json'
            }
        });
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

    createProgressBar(percentage, length = this.progressBarLength) {
        const filledChar = '█';
        const emptyChar = '░';
        const filled = Math.round(percentage * length / 100);
        const empty = length - filled;
        return filledChar.repeat(filled) + emptyChar.repeat(empty);
    }

    async getWakaTimeData() {
        try {
            // First try to get user data
            const userResponse = await this.api.get('/users/current');
            console.log('User data:', userResponse.data);

            // Get status data
            console.log('Fetching status data...');
            const statusResponse = await this.api.get('/users/current/status_bar/today');
            console.log('Raw status response:', statusResponse.data);

            // Get recent projects
            console.log('Fetching recent projects...');
            const date = new Date().toISOString().split('T')[0];
            const projectsResponse = await this.api.get(`/users/current/heartbeats?date=${date}`);
            console.log('Recent projects response:', projectsResponse.data);

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
                console.log('Updated last active project:', this.lastActiveProject);
            }

            const data = {
                currentProject: currentProject || null,
                currentLanguage: statusData.language || userData.last_language || '',
                totalSeconds: statusData.grand_total?.total_seconds || 0,
                isCoding: statusData.is_coding_activity || false,
                lastProject: this.lastActiveProject,
                lastHeartbeat: statusData.heartbeat_at
            };

            console.log('Processed WakaTime data:', data);
            return data;

        } catch (error) {
            console.error('WakaTime API Error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            if (error.response?.status === 402) {
                console.log('Premium API endpoint detected, falling back to basic endpoints...');
                // Implement fallback logic here if needed
            }
            return null;
        }
    }

    createDynamicStatus(wakaTimeData) {
        console.log('Creating status with data:', wakaTimeData);

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
            const projectInfo = language ? `${projectName} (${language})` : projectName;
            statusParts.push(`📁 ${projectInfo}`);
        }

        // Progress Bar (8-hour workday)
        const progressPercentage = Math.min((wakaTimeData.totalSeconds / (8 * 3600)) * 100, 100);
        statusParts.push(`${this.createProgressBar(progressPercentage)} ${Math.round(progressPercentage)}%`);

        const message = statusParts.join(' | ');
        console.log('Created status message:', message);

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
                return false;
            }

            const status = this.createDynamicStatus(wakaTimeData);
            console.log('Updating GitHub status to:', status);

            await this.githubStatus.update(status);
            console.log('Status updated successfully');

            return true;
        } catch (error) {
            console.error('Error updating status:', error);
            return false;
        }
    }

    async start() {
        console.log('Starting WakaTime status updater with debugging...');
        await this.updateStatus();
        setInterval(() => this.updateStatus(), this.updateInterval);
    }
}

const config = {
    updateInterval: 5 * 60 * 1000,
    maxStatusLength: 80,
    progressBarLength: 10
};

try {
    const statusUpdater = new WakaTimeStatus(config);
    statusUpdater.start();
} catch (error) {
    console.error('Failed to start application:', error.message);
}