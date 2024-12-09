# Dynamic GitHub Status Updater

This project is a dynamic GitHub status updater that leverages the WakaTime API to display your current coding activity on your GitHub profile. The status includes your total time tracked, current project, current language, and a progress bar indicating your daily coding progress.

## Features

- Fetches WakaTime data and updates your GitHub status every few minutes
- Displays your total time tracked, current project, current language, and a progress bar
- Includes the most used language of the day (excluding 'Other')
- Animates the status icons to provide a more dynamic and engaging experience
- Handles rate limiting and retries gracefully
- Configurable options like update interval, progress bar length, and debug mode

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/lohitkolluri/GitHub-Dynamic-Status
   ```
2. Install dependencies:
   ```
   cd repo
   npm install
   ```
3. Set up environment variables:
   - `WAKATIME_API_KEY`: Your WakaTime API key
   - `GITHUB_TOKEN`: Your GitHub access token
4. Start the application:
   ```
   npm start
   ```

## Configuration

You can customize the behavior of the status updater by passing a configuration object to the `WakaTimeStatus` constructor. Here are the available options:

| Option              | Type      | Default                         | Description                                                                            |
| ------------------- | --------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| `updateInterval`    | `number`  | `5 * 60 * 1000` (5 minutes)     | The interval (in milliseconds) at which the status is updated.                         |
| `maxStatusLength`   | `number`  | `80`                            | The maximum length of the status message.                                              |
| `progressBarLength` | `number`  | `10`                            | The length of the progress bar in the status message.                                  |
| `retryAttempts`     | `number`  | `3`                             | The number of times to retry fetching data from the WakaTime API.                      |
| `baseURL`           | `string`  | `'https://wakatime.com/api/v1'` | The base URL for the WakaTime API.                                                     |
| `debug`             | `boolean` | `false`                         | Enables debug logging.                                                                 |
| `activityWindow`    | `number`  | `5 * 60` (5 minutes)            | The time (in seconds) after the last heartbeat that a user is considered to be coding. |

Example configuration:

```javascript
const config = {
  updateInterval: 5 * 60 * 1000, // 5 minutes
  maxStatusLength: 80,
  progressBarLength: 10,
  debug: true,
};

const statusUpdater = new WakaTimeStatus(config);
```

## Usage

```javascript
try {
  const statusUpdater = new WakaTimeStatus();

  statusUpdater.on('started', () => console.log('Status updater started'));
  statusUpdater.on('stopped', () => console.log('Status updater stopped'));
  statusUpdater.on('statusUpdated', (status) =>
    console.log('Status updated:', status),
  );
  statusUpdater.on('error', (error) => console.error('Error occurred:', error));

  statusUpdater.start();
} catch (error) {
  console.error('Failed to start application:', error.message);
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a pull request

## License

This project is licensed under the [MIT License](LICENSE).
