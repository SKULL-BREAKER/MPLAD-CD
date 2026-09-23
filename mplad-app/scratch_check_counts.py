import pandas as pd; df = pd.read_csv("data/fraud_labels.csv"); print(df.groupby('pattern').size())
