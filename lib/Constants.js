// lib/constants.js
export const DEFAULT_CONFIG = {
    maxStatusLength: 80,
    progressBarLength: 10,
    retryAttempts: 3,
    baseURL: 'https://wakatime.com/api/v1',
    debug: process.env.NODE_ENV === 'development',
    activityWindow: 60,
    statusConfig: {
        progressFilled: '⬢',
        progressEmpty: '⬡',
        timeIcon: '⏰',
        projectIcon: '📂',
        codingIcon: '⚡',
        idleIcon: '💫',
        errorIcon: '⚠️',
        separator: ' ⟫ '
    },
    animations: {
        pulse: ['⎯', '\\', '|', '/'],
        wave: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
        rotate: ['◜', '◝', '◞', '◟'],
        none: ['']
    }
};