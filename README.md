# Ngabang Gold Prospectivity: calculation engine

Alat *exploration targeting* berbasis model (Ngabang, Kab. Landak, Kalimantan Barat). Ini **bukan detektor emas**: skor adalah **indeks model 0-100, bukan probabilitas**. Status: **UNVALIDATED MODEL**; bobot = **INITIAL MODEL PARAMETER**.

## Status fase

- **Sudah:** normalisasi min-max + directionality, WMCA baseline, strategi missing-data, kontribusi per kriteria (dasar "Why this score?"), tes Vitest.
- **Belum:** data source registry, ingestion/validasi (CRS, geometri), feature engineering, grid, target generation, audit, API, peta, field survey, export, shell Next.js/Vercel.
- Repo ini tidak berisi data, koordinat, atau skor contoh. Angka 72.6 di tes hanyalah **TEST FIXTURE**.

## Model

`Score = 100 x SUM(normalized_i x w_i')`

- Bobot awal ada di `config/model.wmca.v1.json`: Geology 0.30, Structure 0.25, Geochemistry 0.25, Drainage 0.10, Topography 0.10 (jumlah harus tepat 1).
- Kriteria tanpa nilai valid (`null`, `undefined`, `NaN`, di luar 0-1) berstatus `MISSING` dan **tidak pernah dianggap 0**. Nilai 0 yang nyata tetap dihitung sebagai evidence.
- Strategi missing-data: `RENORMALIZE_AVAILABLE_EVIDENCE`, yaitu `w_i' = w_i / SUM(bobot tersedia)`. Jika completeness < 1, status = `INCOMPLETE_SCORE`.
- `minCompleteness` (0.6) adalah **parameter awal yang perlu Anda tetapkan**. Di bawah ambang ini hasilnya `NOT_CALCULABLE` dan skor = `null`.
- Fungsi murni dan deterministik (tanpa randomisasi): input sama menghasilkan hasil sama.

## Menjalankan tes

```bash
npm install
npm test
npm run typecheck
```
