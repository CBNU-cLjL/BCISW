import http.server
import socketserver
import json
import urllib.parse
import pandas as pd
from scipy.io import arff
import numpy as np
from scipy.signal import butter, filtfilt, welch, find_peaks

# Port
PORT = 8000

# Load data on startup
print("Loading ARFF data...")
try:
    data, meta = arff.loadarff('eegeyestate.arff')
    df = pd.DataFrame(data)
except Exception as e:
    print(f"Failed to load eegeyestate.arff: {e}")
    # Fallback to load from dashboard json if arff is missing or fails
    try:
        with open('eeg-dashboard/src/data/eeg_data.json', 'r') as f:
            df = pd.DataFrame(json.load(f))
    except Exception as ex:
        print(f"Fallback loading failed: {ex}")
        df = pd.DataFrame()

# Decode byte strings for eyeDetection
if 'eyeDetection' in df.columns:
    df['eyeDetection'] = df['eyeDetection'].apply(lambda x: int(x.decode('utf-8')) if isinstance(x, bytes) else int(x))

# Remove outliers (same logic as convert_data.py)
feature_cols = [c for c in df.columns if c != 'eyeDetection']
if not df.empty:
    df = df[(df[feature_cols] < 50000).all(axis=1)]
    # Select the first 2000 points to keep time window matching the dashboard
    df_small = df.head(2000).copy().reset_index(drop=True)
else:
    df_small = pd.DataFrame()

CHANNELS = list(feature_cols) if not df_small.empty else []
SAMPLING_RATE = 128  # Emotiv EPOC sampling rate is 128Hz

# Bandpass Butterworth Filter functions
def butter_bandpass(lowcut, highcut, fs, order=4):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    # Clip bounds to avoid illegal values
    low = max(0.001, min(0.999, low))
    high = max(0.001, min(0.999, high))
    b, a = butter(order, [low, high], btype='band')
    return b, a

def bandpass_filter(data, lowcut, highcut, fs, order=4):
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    y = filtfilt(b, a, data)
    return y

class EEGApiHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for the local React dev server
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if path == '/api/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            status_data = {
                "status": "online",
                "channels": CHANNELS,
                "sampling_rate": SAMPLING_RATE,
                "data_points": len(df_small)
            }
            self.wfile.write(json.dumps(status_data).encode())
            
        elif path == '/api/data':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            # Format data exactly as expected by dashboard (list of dicts)
            records = df_small.to_dict(orient='records')
            self.wfile.write(json.dumps(records).encode())
            
        elif path == '/api/analyze':
            # Parameters
            channel = query_params.get('channel', ['AF3'])[0]
            lowcut = float(query_params.get('lowcut', [1.0])[0])
            highcut = float(query_params.get('highcut', [30.0])[0])
            
            if channel not in CHANNELS:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Invalid channel: {channel}"}).encode())
                return
                
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            # 1. Get raw signal
            raw_sig = df_small[channel].values
            mean_val = np.mean(raw_sig)
            
            # Center signal around 0 for PSD/filtering
            raw_sig_centered = raw_sig - mean_val

            # 2. Apply Butterworth filter
            try:
                filtered_sig = bandpass_filter(raw_sig_centered, lowcut, highcut, SAMPLING_RATE)
            except Exception as e:
                # Fallback if filtering fails
                print(f"Filter error: {e}")
                filtered_sig = raw_sig_centered

            # 3. Calculate PSD using Welch's method (SciPy)
            # Use segment length nperseg of 256 for good resolution
            f, psd = welch(raw_sig_centered, SAMPLING_RATE, nperseg=256)
            
            # We only care about frequencies up to 45Hz
            mask = f <= 45.0
            psd_freqs = f[mask].tolist()
            psd_values = psd[mask].tolist()

            # 4. Calculate relative frequency bands power (Delta, Theta, Alpha, Beta)
            bands = {
                'Delta': (0.5, 4.0),
                'Theta': (4.0, 8.0),
                'Alpha': (8.0, 13.0),
                'Beta': (13.0, 30.0)
            }
            
            band_powers = {}
            for name, (low, high) in bands.items():
                band_mask = (f >= low) & (f <= high)
                # Compute band power by integrating (averaging) the PSD in this range
                power_val = np.mean(psd[band_mask]) if np.any(band_mask) else 0.0
                band_powers[name] = float(power_val)

            # Normalize band powers to percentages
            total_power = sum(band_powers.values()) or 1.0
            band_percentages = {k: (v / total_power) * 100 for k, v in band_powers.items()}

            # 5. Peak detection using SciPy find_peaks
            std_val = np.std(filtered_sig)
            # Find peaks that are at least 1.5 standard deviations above 0
            peaks_idx, _ = find_peaks(filtered_sig, height=1.5 * std_val, distance=15)
            
            peaks_list = [{"index": int(idx), "value": float(raw_sig[idx])} for idx in peaks_idx]

            # 6. Eye State Contrast (Berger Effect)
            # Separate data points by eye state: Open (0) vs Closed (1)
            open_mask = df_small['eyeDetection'] == 0
            closed_mask = df_small['eyeDetection'] == 1
            
            alpha_open = 0.0
            alpha_closed = 0.0
            
            if np.sum(open_mask) > 64:
                open_sig = df_small.loc[open_mask, channel].values
                open_sig = open_sig - np.mean(open_sig)
                f_o, psd_o = welch(open_sig, SAMPLING_RATE, nperseg=min(256, len(open_sig)))
                alpha_mask = (f_o >= 8.0) & (f_o <= 13.0)
                alpha_open = float(np.mean(psd_o[alpha_mask])) if np.any(alpha_mask) else 0.0
                
            if np.sum(closed_mask) > 64:
                closed_sig = df_small.loc[closed_mask, channel].values
                closed_sig = closed_sig - np.mean(closed_sig)
                f_c, psd_c = welch(closed_sig, SAMPLING_RATE, nperseg=min(256, len(closed_sig)))
                alpha_mask = (f_c >= 8.0) & (f_c <= 13.0)
                alpha_closed = float(np.mean(psd_c[alpha_mask])) if np.any(alpha_mask) else 0.0

            analysis_result = {
                "channel": channel,
                "lowcut": lowcut,
                "highcut": highcut,
                "raw_signal": raw_sig.tolist(),
                "filtered_signal": (filtered_sig + mean_val).tolist(), # Align visually with raw offset
                "psd_frequencies": psd_freqs,
                "psd_values": psd_values,
                "band_powers": band_powers,
                "band_percentages": band_percentages,
                "peaks": peaks_list,
                "berger_effect": {
                    "alpha_open_power": alpha_open,
                    "alpha_closed_power": alpha_closed,
                    "ratio": (alpha_closed / alpha_open) if alpha_open > 0 else 1.0
                }
            }
            
            self.wfile.write(json.dumps(analysis_result).encode())
        else:
            # Fall back to serving static files for the directory
            return super().do_GET()

if __name__ == '__main__':
    # Allow port reuse to avoid 'address already in use' errors during development restarts
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), EEGApiHandler) as httpd:
        print(f"EEGstate Python backend API serving at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Server shutting down.")
