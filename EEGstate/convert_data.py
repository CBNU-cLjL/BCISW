import pandas as pd
from scipy.io import arff
import json
import numpy as np

def convert_arff_to_json():
    # Load the ARFF file
    data, meta = arff.loadarff('eegeyestate.arff')
    
    # Convert to DataFrame
    df = pd.DataFrame(data)
    
    # Decode byte strings for categorical data
    if 'eyeDetection' in df.columns:
        df['eyeDetection'] = df['eyeDetection'].apply(lambda x: int(x.decode('utf-8')) if isinstance(x, bytes) else int(x))
    
    # --- Outlier Removal ---
    # Identify feature columns (exclude eyeDetection)
    feature_cols = [c for c in df.columns if c != 'eyeDetection']
    
    # Filter out rows where any channel value is extremely high (e.g., > 50,000)
    # Typical values seen in head() were ~4000. The artifact was ~700,000.
    # We keep rows where ALL channels are < 50000
    initial_count = len(df)
    df = df[ (df[feature_cols] < 50000).all(axis=1) ]
    print(f"Dropped {initial_count - len(df)} outlier rows (values > 50,000)")

    # Downsample for visualization if needed (e.g., take every 10th point to keep file size manageable for web)
    # The dataset might be large. Let's check size first, but for now let's take first 1000 points for the demo dashboard
    # or downsample. Let's take the first 2000 points for a responsive demo.
    df_small = df.head(2000)
    
    # Convert to list of dicts
    result = df_small.to_dict(orient='records')
    
    # Write to JSON
    output_path = 'eeg-dashboard/src/data/eeg_data.json'
    with open(output_path, 'w') as f:
        json.dump(result, f)
    
    print(f"Converted {len(df_small)} records to {output_path}")

if __name__ == "__main__":
    convert_arff_to_json()
