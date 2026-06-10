# EEG Visualization Dashboard

This is a React-based dashboard for visualizing EEG data, similar to TensorBoard.

## Features
- **Time Series Visualization**: View 14 channels of EEG signals.
- **Interactive Controls**: Toggle channels on/off, adjust time window.
- **State Analysis**: View Eye Detection state (Open/Closed) alongside the signals.
- **Statistics**: Real-time calculation of signal power and eye state probability for the current window.

## Setup & Run

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Run the development server:
    ```bash
    npm run dev
    ```

3.  Open the link provided (usually `http://localhost:5173`) in your browser.

## Data Processing
The raw ARFF data was converted to JSON using `../convert_data.py`. If you update the ARFF file, run the python script again to update `src/data/eeg_data.json`.
