# Simulasi Monte Carlo Risiko Harga Saham Tesla (TSLA)

TA-03 Pemodelan dan Simulasi. Selsa Shafana Alfiyani (301240041).

Aplikasi web Flask yang menghitung probabilitas harga saham Tesla turun lebih dari X% dalam N hari,
memakai simulasi Monte Carlo dengan parameter (mean dan standar deviasi return harian) dari data historis.
Halaman disusun mengikuti alur tugas: Ringkasan, Langkah 1 (Eksplorasi Data), Langkah 2 (Simulasi),
Langkah 3 (Analisis Risiko), dan Kesimpulan.

## Struktur
- `app.py`                       : aplikasi Flask, pengolahan data, dan logika simulasi
- `templates/index.html`         : halaman web
- `static/css/style.css`         : tampilan
- `static/js/app.js`             : interaksi dan grafik
- `static/js/chart.umd.js`       : library Chart.js (disertakan, tidak perlu internet)
- `data/tesla_stock_dataset.csv` : dataset Tesla (Kaggle)
- `requirements.txt`             : daftar library Python

## Menjalankan di komputer sendiri
```
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
python app.py
```
Buka http://127.0.0.1:5000

## Deploy di Render.com
1. Upload folder ini ke repositori GitHub (folder `venv` tidak ikut karena sudah ada di `.gitignore`).
2. Di Render: New > Web Service > pilih repositori.
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `gunicorn app:app`
5. Environment Variable: `PYTHON_VERSION` = `3.11.9`
6. Klik Create Web Service, lalu salin link hasil deploy untuk laporan.
