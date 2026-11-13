/* TA-03 Simulasi Monte Carlo Saham Tesla | Selsa Shafana Alfiyani (301240041) */
(function () {
  'use strict';

  const D = window.DATA;     // hasil Langkah 1 dari server
  const B = window.BATAS;    // batas dan nilai default input
  const NAVY = '#12355b', BLUE = '#1f5f99', RISK = '#c0392b';

  const $ = (id) => document.getElementById(id);
  const fmt = (n, d = 0) =>
    new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  const fmtBatas = (n) => fmt(n, Number.isInteger(n) ? 0 : 1);

  let chartAkhir = null;
  let chartJalur = null;
  let hasilTerakhir = null;
  let timerBatas = null;

  Chart.defaults.font.family = '"Segoe UI", system-ui, sans-serif';
  Chart.defaults.color = '#5a6b7d';

  /* ---------- Navigasi: tandai bagian aktif dan bilah progres ---------- */
  const navLinks = Array.from(document.querySelectorAll('#nav a'));
  const bagian = navLinks.map((a) => document.getElementById(a.dataset.section));

  function perbaruiNavigasi() {
    const y = window.scrollY + 120;
    let aktif = bagian[0];
    bagian.forEach((s) => { if (s.offsetTop <= y) aktif = s; });
    navLinks.forEach((a) => a.classList.toggle('active', a.dataset.section === aktif.id));

    const h = document.documentElement;
    const total = h.scrollHeight - h.clientHeight;
    $('progress').style.width = (total > 0 ? (window.scrollY / total) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', perbaruiNavigasi, { passive: true });
  perbaruiNavigasi();

  /* ---------- Input: slider dan kotak angka saling sinkron ---------- */
  function sinkron(idDasar, min, max, saatBerubah) {
    const angka = $(idDasar), slider = $(idDasar + '-range');
    slider.addEventListener('input', () => { angka.value = slider.value; if (saatBerubah) saatBerubah(); });
    angka.addEventListener('input', () => { slider.value = angka.value; if (saatBerubah) saatBerubah(); });
    angka.addEventListener('change', () => {
      let v = parseFloat(angka.value);
      if (isNaN(v)) v = min;
      v = Math.min(max, Math.max(min, v));
      angka.value = v;
      slider.value = v;
      if (saatBerubah) saatBerubah();
    });
  }

  function perbaruiLabelBatas() {
    $('batas-label').textContent = fmtBatas(parseFloat($('batas').value) || B.default_batas) + '%';
  }

  function jalankanTertunda() {
    perbaruiLabelBatas();
    clearTimeout(timerBatas);
    timerBatas = setTimeout(jalankan, 350);
  }

  sinkron('skenario', B.min_skenario, B.max_skenario);
  sinkron('hari', B.min_hari, B.max_hari);
  sinkron('batas', B.min_batas, B.max_batas, jalankanTertunda);

  /* ---------- Plugin: garis vertikal pada histogram ---------- */
  const garisPlugin = {
    id: 'garis',
    afterDatasetsDraw(chart, args, opsi) {
      const garis = (opsi && opsi.garis) || [];
      const { ctx, chartArea, scales } = chart;
      if (!scales.x) return;
      garis.forEach((g, i) => {
        const px = scales.x.getPixelForValue(g.indeks);
        if (!(px >= chartArea.left && px <= chartArea.right)) return;
        ctx.save();
        ctx.strokeStyle = g.warna;
        ctx.lineWidth = 2;
        ctx.setLineDash(g.putus || []);
        ctx.beginPath();
        ctx.moveTo(px, chartArea.top);
        ctx.lineTo(px, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = g.warna;
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign = g.rata;
        ctx.fillText(g.label, px + (g.rata === 'right' ? -6 : 6), chartArea.top + 14 + i * 16);
        ctx.restore();
      });
    }
  };

  /* ---------- Langkah 1: histogram return harian ---------- */
  function gambarHistReturn() {
    const h = D.hist_return;
    new Chart($('chart-return'), {
      data: {
        labels: h.pusat.map((v) => fmt(v * 100, 1) + '%'),
        datasets: [
          { type: 'bar', label: 'Return harian Tesla', data: h.kepadatan,
            backgroundColor: 'rgba(31,95,153,0.55)', borderColor: BLUE, borderWidth: 1,
            categoryPercentage: 1, barPercentage: 1, order: 2 },
          { type: 'line', label: 'Kurva Normal (μ, σ)', data: h.kurva,
            borderColor: RISK, borderWidth: 2, pointRadius: 0, tension: 0.3, order: 1 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { title: { display: true, text: 'Return harian' }, ticks: { maxTicksLimit: 10, autoSkip: true }, grid: { display: false } },
          y: { title: { display: true, text: 'Kepadatan' } }
        }
      }
    });
  }

  /* ---------- Langkah 2: contoh jalur harga ---------- */
  function gambarJalur(r) {
    const label = Array.from({ length: r.hari + 1 }, (_, i) => i);
    const set = r.jalur.map((j) => ({
      data: j, borderColor: 'rgba(31,95,153,0.28)', borderWidth: 1, pointRadius: 0, tension: 0
    }));
    set.push({ data: label.map(() => r.batas_harga), borderColor: RISK, borderWidth: 2, borderDash: [8, 6], pointRadius: 0 });
    set.push({ data: label.map(() => r.harga_awal), borderColor: NAVY, borderWidth: 2, pointRadius: 0 });

    if (chartJalur) chartJalur.destroy();
    chartJalur = new Chart($('chart-jalur'), {
      type: 'line',
      data: { labels: label, datasets: set },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, events: [],
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { title: { display: true, text: 'Hari ke-' }, ticks: { maxTicksLimit: 12 } },
          y: { title: { display: true, text: 'Harga (USD)' } }
        }
      }
    });
    $('caption-jalur').textContent =
      'Garis biru tipis adalah ' + fmt(r.jalur.length) + ' dari ' + fmt(r.skenario) +
      ' jalur simulasi. Garis merah putus-putus adalah batas penurunan (' + fmt(r.batas_harga, 2) +
      ' USD) dan garis biru tua adalah harga awal (' + fmt(r.harga_awal, 2) + ' USD).';
  }

  /* ---------- Langkah 3: histogram hasil akhir dengan batas risiko ---------- */
  function gambarHistAkhir(r) {
    const e = r.hist_akhir.tepi, jumlah = r.hist_akhir.jumlah, n = jumlah.length;
    const lebar = (e[n] - e[0]) / n;
    const pusat = jumlah.map((_, i) => (e[i] + e[i + 1]) / 2);
    const indeks = (v) => (v - e[0]) / lebar - 0.5;

    if (chartAkhir) chartAkhir.destroy();
    chartAkhir = new Chart($('chart-akhir'), {
      type: 'bar',
      plugins: [garisPlugin],
      data: {
        labels: pusat.map((v) => fmt(v, 0)),
        datasets: [{
          label: 'Jumlah skenario', data: jumlah,
          backgroundColor: pusat.map((v) => (v < r.batas_harga ? 'rgba(192,57,43,0.75)' : 'rgba(31,95,153,0.6)')),
          borderWidth: 0, categoryPercentage: 1, barPercentage: 1
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: (items) => 'Sekitar ' + items[0].label + ' USD', label: (c) => fmt(c.parsed.y) + ' skenario' } },
          garis: {
            garis: [
              { indeks: indeks(r.batas_harga), warna: RISK, putus: [8, 6], rata: 'right', label: 'Batas ' + fmt(r.batas_harga, 2) },
              { indeks: indeks(r.harga_awal), warna: NAVY, putus: [], rata: 'left', label: 'Harga awal ' + fmt(r.harga_awal, 2) }
            ]
          }
        },
        scales: {
          x: { title: { display: true, text: 'Harga akhir (USD)' }, ticks: { maxTicksLimit: 10, autoSkip: true }, grid: { display: false } },
          y: { title: { display: true, text: 'Jumlah skenario' } }
        }
      }
    });
  }

  /* ---------- Menampilkan angka hasil dan kesimpulan ---------- */
  function tampilkanAngka(r) {
    $('result-judul').textContent =
      'Probabilitas harga turun lebih dari ' + fmtBatas(r.batas_persen) + '% dalam ' + fmt(r.hari) + ' hari';
    $('result-prob').textContent = fmt(r.probabilitas, 2) + '%';
    $('result-detail').textContent =
      fmt(r.jumlah_turun) + ' dari ' + fmt(r.skenario) + ' skenario berakhir di bawah ' + fmt(r.batas_harga, 2) + ' USD';

    $('m-awal').textContent = fmt(r.harga_awal, 2) + ' USD';
    $('m-batas').textContent = fmt(r.batas_harga, 2) + ' USD';
    $('m-rata').textContent = fmt(r.rata_rata, 2) + ' USD';
    $('m-median').textContent = fmt(r.median, 2) + ' USD';
    $('m-p5').textContent = fmt(r.p5, 2) + ' USD';
    $('m-p95').textContent = fmt(r.p95, 2) + ' USD';
    $('m-perubahan').textContent = fmt(r.perubahan_p5, 2) + '%';
    $('m-sempat').textContent = fmt(r.sempat_turun, 2) + '%';
  }

  function teksKesimpulan(r) {
    return [
      'Parameter diambil dari ' + fmt(D.jumlah_return) + ' return harian saham Tesla (Adj Close, ' +
        D.tanggal_awal + ' sampai ' + D.tanggal_akhir + '): rata-rata (μ) sekitar ' + fmt(D.mu * 100, 2) +
        '% per hari dan standar deviasi (σ) sekitar ' + fmt(D.sigma * 100, 2) + '% per hari.',
      'Dengan ' + fmt(r.skenario) + ' skenario selama ' + fmt(r.hari) + ' hari dari harga awal ' + fmt(r.harga_awal, 2) +
        ' USD, probabilitas harga turun lebih dari ' + fmtBatas(r.batas_persen) + '% (di bawah ' + fmt(r.batas_harga, 2) +
        ' USD) adalah sekitar ' + fmt(r.probabilitas, 2) + '%.',
      'Jika dihitung peluang harga sempat menyentuh batas tersebut di hari mana pun selama ' + fmt(r.hari) +
        ' hari, angkanya lebih tinggi, yaitu sekitar ' + fmt(r.sempat_turun, 2) + '%.',
      'Harga akhir rata-rata sekitar ' + fmt(r.rata_rata, 2) + ' USD, dengan 90% skenario berada di rentang sekitar ' +
        fmt(r.p5, 0) + ' sampai ' + fmt(r.p95, 0) + ' USD. Pada persentil ke-5, harga berubah sekitar ' +
        fmt(r.perubahan_p5, 1) + '% dari harga awal.'
    ];
  }

  function tampilkanKesimpulan(r) {
    $('kesimpulan-list').innerHTML = teksKesimpulan(r).map((t) => '<li>' + t + '</li>').join('');
  }

  /* ---------- Menjalankan simulasi lewat API ---------- */
  function atur(pesan, galat) {
    const el = $('status');
    el.textContent = pesan;
    el.classList.toggle('error', !!galat);
  }

  async function jalankan() {
    const muatan = {
      skenario: parseInt($('skenario').value, 10),
      hari: parseInt($('hari').value, 10),
      seed: parseInt($('seed').value, 10),
      batas: parseFloat($('batas').value)
    };
    const tombol = $('btn-run');
    tombol.disabled = true;
    tombol.textContent = 'Memproses...';
    atur('Menjalankan simulasi...');
    const mulai = Date.now();

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(muatan)
      });
      if (!res.ok) throw new Error('server mengembalikan status ' + res.status);
      const r = await res.json();
      hasilTerakhir = r;

      gambarJalur(r);
      tampilkanAngka(r);
      gambarHistAkhir(r);
      tampilkanKesimpulan(r);

      const detik = ((Date.now() - mulai) / 1000).toFixed(2).replace('.', ',');
      atur('Simulasi selesai: ' + fmt(r.skenario) + ' skenario x ' + fmt(r.hari) + ' hari (' + detik + ' detik). Hasil ada di Langkah 3.');
    } catch (err) {
      atur('Terjadi kesalahan: ' + err.message + '. Coba jalankan lagi.', true);
    } finally {
      tombol.disabled = false;
      tombol.textContent = 'Jalankan Simulasi';
    }
  }

  $('form-sim').addEventListener('submit', (e) => { e.preventDefault(); jalankan(); });

  $('btn-reset').addEventListener('click', () => {
    [['skenario', B.default_skenario], ['hari', B.default_hari], ['batas', B.default_batas]].forEach(([id, nilai]) => {
      $(id).value = nilai;
      $(id + '-range').value = nilai;
    });
    $('seed').value = B.seed;
    perbaruiLabelBatas();
    jalankan();
  });

  /* ---------- Salin ringkasan hasil ---------- */
  $('btn-copy').addEventListener('click', async () => {
    const info = $('copy-status');
    if (!hasilTerakhir) { info.textContent = 'Jalankan simulasi terlebih dahulu.'; return; }
    const teks = 'Ringkasan Simulasi Monte Carlo Saham Tesla (TSLA)\n' +
      teksKesimpulan(hasilTerakhir).map((t, i) => (i + 1) + '. ' + t).join('\n');
    try {
      await navigator.clipboard.writeText(teks);
      info.textContent = 'Ringkasan berhasil disalin.';
    } catch (err) {
      info.textContent = 'Penyalinan otomatis tidak didukung browser ini.';
    }
  });

  /* ---------- Mulai ---------- */
  gambarHistReturn();
  perbaruiLabelBatas();
  jalankan();
})();
