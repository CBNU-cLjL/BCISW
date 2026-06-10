from scipy.io import arff
import pandas as pd

# Load the ARFF file
# data is a NumPy record array, meta is the metadata
data, meta = arff.loadarff('eegeyestate.arff')

# Convert the record array to a Pandas DataFrame
df = pd.DataFrame(data)

# Note: Nominal/categorical attributes (like eyeDetection) are loaded as byte strings (e.g., b'0', b'1'). 
# You might need to decode them:
# df['eyeDetection'] = df['eyeDetection'].str.decode('utf-8').astype(int) 

print(df.head())