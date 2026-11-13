"""
TA-03 Pemodelan dan Simulasi
Aplikasi web Simulasi Monte Carlo: risiko penurunan harga saham Tesla (TSLA).
Nama : Selsa Shafana Alfiyani
NIM  : 301240041
"""
import os

import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "tesla_stock_dataset.csv")
SEED_DEFAULT = 301240041  # NIM

# Batas input agar server tidak kelebihan beban
MIN_SKENARIO, MAX_SKENARIO, DEFAULT_SKENARIO = 5000, 50000, 10000
MIN_HARI, MAX_HARI, DEFAULT_HARI = 1, 365, 30
MIN_BATAS, MAX_BATAS, DEFAULT_BATAS = 1.0, 50.0, 10.0
BATAS_OUTLIER = 0.50      # return harian di luar +-50% dianggap outlier ekstrem
JUMLAH_JALUR_GRAFIK = 60  # jumlah jalur yang dikirim untuk grafik


def muat_data():
    """Langkah 1: load data, cleaning, dan ekstraksi parameter (mu dan sigma)."""
    mentah = pd.read_csv(DATA_PATH)
    jumlah_kosong = int(mentah.isnull().sum().sum())

    df = mentah.copy()
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date").reset_index(drop=True)
    jumlah_ganda = int(df["Date"].duplicated().sum())
    df = df.dropna().drop_duplicates(subset="Date").reset_index(drop=True)

    return_harian = df["Adj Close"].pct_change().dropna()
    mu_awal, sigma_awal = return_harian.mean(), return_harian.std()
    lebih_3_sigma = int(((return_harian - mu_awal).abs() > 3 * sigma_awal).sum())
    outlier_ekstrem = int((return_harian.abs() > BATAS_OUTLIER).sum())
    return_min, return_max = float(return_harian.min()), float(return_harian.max())
    return_harian = return_harian[return_harian.abs() <= BATAS_OUTLIER]

    mu = float(return_harian.mean())
    sigma = float(return_harian.std())

    # Histogram return harian (kepadatan) dan kurva Normal pembanding
    kepadatan, tepi = np.histogram(return_harian, bins=60, density=True)
    pusat = (tepi[:-1] + tepi[1:]) / 2
    kurva = np.exp(-0.5 * ((pusat - mu) / sigma) ** 2) / (sigma * np.sqrt(2 * np.pi))

    cuplikan = df.head(5).copy()
    cuplikan["Date"] = cuplikan["Date"].dt.strftime("%Y-%m-%d")
    kolom = ["Date", "Adj Close", "Close", "High", "Low", "Open", "Volume"]
    baris_cuplikan = [
        [r["Date"]] + [round(float(r[k]), 4) for k in kolom[1:6]] + [int(r["Volume"])]
        for _, r in cuplikan.iterrows()
    ]

    return {
        "jumlah_baris": int(len(df)),
        "kolom": kolom,
        "tanggal_awal": df["Date"].iloc[0].date().isoformat(),
        "tanggal_akhir": df["Date"].iloc[-1].date().isoformat(),
        "cuplikan": baris_cuplikan,
        "jumlah_kosong": jumlah_kosong,
        "jumlah_ganda": jumlah_ganda,
        "outlier_ekstrem": outlier_ekstrem,
        "lebih_3_sigma": lebih_3_sigma,
        "return_min": return_min,
        "return_max": return_max,
        "jumlah_return": int(len(return_harian)),
        "mu": mu,
        "sigma": sigma,
        "skewness": float(return_harian.skew()),
        "kurtosis": float(return_harian.kurt()),
        "harga_awal": float(df["Adj Close"].iloc[-1]),
        "hist_return": {
            "pusat": [round(float(x), 5) for x in pusat],
            "kepadatan": [round(float(x), 4) for x in kepadatan],
            "kurva": [round(float(x), 4) for x in kurva],
        },
    }


DATA = muat_data()  # dihitung sekali saat aplikasi dijalankan


@app.template_filter("idn")
def format_indonesia(nilai, desimal=0):
    """Format angka gaya Indonesia: titik untuk ribuan, koma untuk desimal."""
    teks = f"{nilai:,.{desimal}f}"
    return teks.replace(",", "#").replace(".", ",").replace("#", ".")


def jalankan_simulasi(skenario, hari, batas_persen, seed):
    """Langkah 2 dan 3: simulasi Monte Carlo, price_t = price_(t-1) * (1 + return_acak)."""
    mu, sigma, harga_awal = DATA["mu"], DATA["sigma"], DATA["harga_awal"]

    np.random.seed(seed)
    return_acak = np.random.normal(mu, sigma, size=(skenario, hari))
    jalur = harga_awal * np.cumprod(1 + return_acak, axis=1)

    harga_akhir = jalur[:, -1]
    batas_harga = harga_awal * (1 - batas_persen / 100)
    turun = harga_akhir < batas_harga

    counts, edges = np.histogram(harga_akhir, bins=50)
    contoh = jalur[:JUMLAH_JALUR_GRAFIK]
    contoh = np.hstack([np.full((contoh.shape[0], 1), harga_awal), contoh])  # hari ke-0

    return {
        "skenario": skenario,
        "hari": hari,
        "batas_persen": batas_persen,
        "seed": seed,
        "harga_awal": harga_awal,
        "batas_harga": float(batas_harga),
        "jumlah_turun": int(turun.sum()),
        "probabilitas": float(turun.mean()) * 100,
        "sempat_turun": float((jalur.min(axis=1) < batas_harga).mean()) * 100,
        "rata_rata": float(harga_akhir.mean()),
        "median": float(np.median(harga_akhir)),
        "p5": float(np.percentile(harga_akhir, 5)),
        "p95": float(np.percentile(harga_akhir, 95)),
        "perubahan_p5": float(np.percentile((harga_akhir - harga_awal) / harga_awal, 5)) * 100,
        "hist_akhir": {"tepi": [round(float(x), 2) for x in edges], "jumlah": [int(x) for x in counts]},
        "jalur": [[round(float(v), 2) for v in baris] for baris in contoh],
    }


def angka(nilai, default, tipe, minimum, maksimum):
    """Ubah input ke angka dan batasi ke rentang yang diizinkan."""
    try:
        nilai = tipe(nilai)
    except (TypeError, ValueError):
        nilai = default
    return max(minimum, min(maksimum, nilai))


@app.route("/")
def index():
    batas = {
        "min_skenario": MIN_SKENARIO, "max_skenario": MAX_SKENARIO, "default_skenario": DEFAULT_SKENARIO,
        "min_hari": MIN_HARI, "max_hari": MAX_HARI, "default_hari": DEFAULT_HARI,
        "min_batas": MIN_BATAS, "max_batas": MAX_BATAS, "default_batas": DEFAULT_BATAS,
        "seed": SEED_DEFAULT,
    }
    return render_template("index.html", d=DATA, b=batas)


@app.route("/api/simulate", methods=["POST"])
def api_simulate():
    isi = request.get_json(silent=True) or {}
    skenario = angka(isi.get("skenario"), DEFAULT_SKENARIO, int, MIN_SKENARIO, MAX_SKENARIO)
    hari = angka(isi.get("hari"), DEFAULT_HARI, int, MIN_HARI, MAX_HARI)
    batas = angka(isi.get("batas"), DEFAULT_BATAS, float, MIN_BATAS, MAX_BATAS)
    seed = angka(isi.get("seed"), SEED_DEFAULT, int, 0, 2**32 - 1)
    return jsonify(jalankan_simulasi(skenario, hari, batas, seed))


if __name__ == "__main__":
    app.run(debug=True)
