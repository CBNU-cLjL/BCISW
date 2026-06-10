import json
import pandas as pd

def analyze_peaks():
    with open('eeg-dashboard/src/data/eeg_data.json', 'r') as f:
        data = json.load(f)
    
    df = pd.DataFrame(data)
    
    # Exclude eyeDetection from signal analysis
    channels = [c for c in df.columns if c != 'eyeDetection']
    
    # Find global max
    max_val = -float('inf')
    max_loc = None
    
    # Find global min
    min_val = float('inf')
    min_loc = None
    
    peaks = []
    
    for idx, row in df.iterrows():
        for ch in channels:
            val = row[ch]
            peaks.append({
                'time_index': idx,
                'channel': ch,
                'value': val,
                'eye_state': row['eyeDetection']
            })
            
            if val > max_val:
                max_val = val
                max_loc = (idx, ch, row['eyeDetection'])
            
            if val < min_val:
                min_val = val
                min_loc = (idx, ch, row['eyeDetection'])
                
    # Sort by absolute magnitude to find most prominent features
    peaks.sort(key=lambda x: abs(x['value']), reverse=True)
    
    print("Top 5 Signal Peaks (by magnitude):")
    for i in range(5):
        p = peaks[i]
        print(f"Rank {i+1}: Value {p['value']:.2f} uV at Time {p['time_index']} on Channel {p['channel']} (Eye: {'Closed' if p['eye_state']==1 else 'Open'})")

if __name__ == "__main__":
    analyze_peaks()
