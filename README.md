# GitHub Dynamic Status 🚀

<div align="center">

[![GitHub license](https://img.shields.io/github/license/Naereen/StrapDown.js.svg)](https://github.com/your-username/github-dynamic-status/blob/main/LICENSE)
[![GitHub latest commit](https://img.shields.io/github/last-commit/lohitkolluri/GitHub-Dynamic-Status)](https://github.com/lohitkolluri/GitHub-Dynamic-Status/commits/main)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2016.0.0-brightgreen)](https://nodejs.org/)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flohitkolluri%2FGitHub-Dynamic-Status&env=WAKATIME_API_KEY,GITHUB_TOKEN,NODE_ENV&envDescription=API%20Keys%20needed%20for%20the%20application&envLink=https%3A%2F%2Fgithub.com%2Flohitkolluri%2FGitHub-Dynamic-Status%23-configuration&project-name=github-dynamic-status&repository-name=github-dynamic-status&demo-url=https%3A%2F%2Fgithub.com%2Flohitkolluri%2FGitHub-Dynamic-Status)

Update your GitHub status with WakaTime coding metrics in real-time!

```
⏰ 2h15m ⟫ 📂 github-dynamic-status ⟫ ⬢⬢⬢⬢⬢⬡⬡⬡⬡⬡ 45% ⟫ JavaScript
```

[Features](#features) • [Installation](#installation) • [Configuration](#configuration) • [Deploy](#deploy) • [Contributing](#contributing)

</div>

## ✨ Features

- **Real-time Updates**: Automatically syncs your GitHub status with WakaTime activity
- **Smart Progress Tracking**: Visual progress bar showing daily coding progress (target: 8 hours)
- **Language Detection**: Shows your currently active programming language
- **Project Awareness**: Displays your current project name
- **Customizable Updates**: Configurable update intervals and display formats
- **Animated Icons**: Optional animated status indicators
- **Rate Limiting**: Smart retry mechanism with exponential backoff
- **Debug Mode**: Detailed logging in development environment
- **Environment-Based Optimization**: Automatic optimization based on NODE_ENV setting
- **One-Click Deploy**: Easy deployment to Vercel with environment configuration

## 🚀 Getting Started

### Prerequisites

- Node.js (>= 16.0.0)
- A WakaTime account with API key
- A GitHub account with personal access token

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/lohitkolluri/GitHub-Dynamic-Status.git
   cd GitHub-Dynamic-Status
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:

   ```env
   WAKATIME_API_KEY=your-wakatime-api-key
   GITHUB_TOKEN=your-github-token
   NODE_ENV=dev    # Use 'dev' for development or 'prod' for production
   ```

4. **Start the application**

   ```bash
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

## 🌟 Deploy

### Deploy on Vercel

You can deploy your own version of GitHub Dynamic Status with one click using the button below:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flohitkolluri%2FGitHub-Dynamic-Status&env=WAKATIME_API_KEY,GITHUB_TOKEN,NODE_ENV&envDescription=API%20Keys%20needed%20for%20the%20application&envLink=https%3A%2F%2Fgithub.com%2Flohitkolluri%2FGitHub-Dynamic-Status%23-configuration&project-name=github-dynamic-status&repository-name=github-dynamic-status&demo-url=https%3A%2F%2Fgithub.com%2Flohitkolluri%2FGitHub-Dynamic-Status)

#### Steps for Vercel Deployment:

1. Click the "Deploy with Vercel" button above
2. Set up the required environment variables:
   - `WAKATIME_API_KEY`: Your WakaTime API key
   - `GITHUB_TOKEN`: Your GitHub personal access token
   - `NODE_ENV`: Set to 'prod' for production deployment
3. Click "Deploy"

Vercel will automatically:

- Clone the repository
- Install dependencies
- Build the application
- Deploy it to a production URL

## ⚙️ Configuration

### Environment Configuration (NODE_ENV)

The application behavior changes based on the `NODE_ENV` environment variable:

#### Development Mode (`NODE_ENV=dev`)

- Enables detailed logging for debugging
- Shows status update information in console
- Updates GitHub status at regular intervals
- Includes additional debug information in logs
- Perfect for local development and testing

#### Production Mode (`NODE_ENV=prod`)

- Minimizes logging for optimal performance
- Only logs critical errors
- Optimized for serverless deployment
- Reduced memory footprint
- Better suited for continuous running on servers

### Application Configuration

The application can be configured by passing a config object when initializing:

```javascript
const config = {
  updateInterval: 5 * 60 * 1000, // 5 minutes
  maxStatusLength: 80,
  progressBarLength: 10,
  retryAttempts: 3,
  debug: process.env.NODE_ENV === 'dev',
  activityWindow: 5 * 60, // 5 minutes in seconds
};

const statusUpdater = new WakaTimeStatus(config);
```

### Configuration Options

| Option              | Type    | Default | Description                                       |
| ------------------- | ------- | ------- | ------------------------------------------------- |
| `updateInterval`    | number  | 300000  | Status update frequency in milliseconds           |
| `maxStatusLength`   | number  | 80      | Maximum length of status message                  |
| `progressBarLength` | number  | 10      | Length of the progress bar in characters          |
| `retryAttempts`     | number  | 3       | Number of retry attempts for API calls            |
| `debug`             | boolean | false   | Enable debug logging (auto-set based on NODE_ENV) |
| `activityWindow`    | number  | 300     | Time window to consider active coding (seconds)   |

## 🎨 Status Format

Your GitHub status will be updated with the following format:

```
[Time Icon] [Coding Time] ⟫ [Project Icon] [Project Name] ⟫ [Progress Bar] [Percentage] ⟫ [Top Language of The Day]
```

Example:

```
⏰ 2h15m ⟫ 📂 github-dynamic-status ⟫ ⬢⬢⬢⬢⬢⬡⬡⬡⬡⬡ 45% ⟫ JavaScript
```

## 🔄 Event Handling

The application emits various events that you can listen to:

```javascript
statusUpdater.on('started', () => console.log('Status updater started'));
statusUpdater.on('stopped', () => console.log('Status updater stopped'));
statusUpdater.on('statusUpdated', (status) =>
  console.log('Status updated:', status),
);
statusUpdater.on('error', (error) => console.error('Error occurred:', error));
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

</div>
