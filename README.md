# Taski - Desktop Task Manager

A lightweight, always-accessible task manager that sits on the side of your screen and opens automatically on system startup.

## Features

- ✅ **Auto-start on system boot** - Launches automatically when your computer starts
- 📍 **Side panel positioning** - Small window positioned at the side of your screen
- 📝 **Custom zones** - Create and organize tasks into custom priority zones
- 🎨 **Color-coded sections** - Assign colors to different zones for quick visual identification
- ✏️ **Editable tasks** - Click on any task or zone title to edit it inline
- 🔄 **Drag-and-drop** - Rearrange tasks between zones and reorder zones
- 💾 **Auto-save** - All changes are saved immediately to local storage
- 🔔 **Confirmation dialogs** - Confirms before completing or deleting tasks/zones
- 🎯 **Persistent data** - Tasks and zones persist across computer restarts

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

Download both from [nodejs.org](https://nodejs.org/) if you don't have them installed.

### Installation & Running

1. **Clone or download this repository**

2. **Navigate to the project directory:**
   ```bash
   cd Taski
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

   This will download Electron and other required packages. The first install may take a few minutes.

4. **Run the application:**
   ```bash
   npm start
   ```

   The task manager window will open on the right side of your screen!

## Usage

### Adding Tasks

1. Type your task description in the "Add Task" input field at the top
2. Click "Add to Urgent" or press Enter
3. The task will appear at the top of the first (most urgent) zone

### Managing Zones

- **Add a zone:** Enter a title in the "Add Zone" field and click "Add Zone"
- **Rename a zone:** Click on the zone title and edit it inline
- **Change zone color:** Click the settings icon (⚙️) next to the zone title and select a color
- **Reorder zones:** Drag zones by their headers to rearrange their order
- **Delete a zone:** Click the trash icon - this will also delete all tasks in that zone (with confirmation)

### Managing Tasks

- **Edit a task:** Click on the task text and edit it inline
- **Move a task:** Drag and drop tasks between different zones
- **Complete a task:** Click the checkmark icon (you'll be asked to confirm)

### Default Zones

The app comes with three pre-configured zones:
- 🔴 **Urgent** - High priority tasks
- 🟠 **Middling** - Medium priority tasks
- 🟢 **Not Urgent** - Low priority tasks

You can customize, remove, or add to these zones as needed.

## Building for Distribution

### Build for your platform:

**Windows:**
```bash
npm run build:win
```

**macOS:**
```bash
npm run build:mac
```

**Linux:**
```bash
npm run build:linux
```

The built application will be in the `dist` folder.

## Auto-start Configuration

By default, the application is configured to start automatically when your computer boots up. This setting is enabled by default but can be modified in the `main.js` file if needed.

## Data Storage

All tasks and zones are stored locally using `electron-store`, which saves data to:

- **Windows:** `%APPDATA%\taski\config.json`
- **macOS:** `~/Library/Application Support/taski/config.json`
- **Linux:** `~/.config/taski/config.json`

## Keyboard Shortcuts

- **Enter** in the task input field: Add new task
- **Enter** in the zone input field: Add new zone
- **Escape** in modal dialogs: Cancel action

## Troubleshooting

### App doesn't start on boot

Check your system's startup applications settings:
- **Windows:** Task Manager → Startup tab
- **macOS:** System Preferences → Users & Groups → Login Items
- **Linux:** Varies by distribution

### Tasks not saving

Make sure the application has write permissions to its config directory. Check the paths listed in the "Data Storage" section above.

## Development

### Project Structure

```
taski/
├── main.js          # Electron main process
├── preload.js       # Preload script for IPC
├── renderer.js      # Application logic
├── index.html       # HTML structure
├── styles.css       # Styling
├── package.json     # Dependencies and scripts
└── README.md        # Documentation
```

### Technologies Used

- **Electron** - Desktop application framework
- **electron-store** - Simple data persistence
- **Vanilla JavaScript** - No heavy frameworks, lightweight and fast
- **CSS3** - Modern styling with flexbox

## License

MIT

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
