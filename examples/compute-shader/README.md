# Compute Shader Example (Elliptic Data Set)

This example uses the **Elliptic Data Set** from Kaggle and expects the CSV files to be available under `examples/compute-shader/assets/`.

Dataset page: https://www.kaggle.com/datasets/ellipticco/elliptic-data-set

## Download the CSV assets

1. Open the Kaggle dataset page and download the dataset archive:
   - https://www.kaggle.com/datasets/ellipticco/elliptic-data-set
2. Extract the downloaded archive.
3. Copy the following files into `examples/compute-shader/assets/`:
   - `elliptic_txs_classes.csv`
   - `elliptic_txs_edgelist.csv`

Notes:
- `examples/compute-shader/assets/*.csv` is intentionally gitignored (see `.gitignore`), so you should download these locally.
- The dataset also includes `elliptic_txs_features.csv`. This example does not require it by default.

## Run the example

```bash
cd examples/compute-shader
bun install
bun run dev
```

