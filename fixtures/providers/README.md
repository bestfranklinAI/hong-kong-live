# Provider fixtures

These are actual JSON responses captured on 13 September 2026 during the first implementation. They are small, versioned regression inputs, not simulated live feeds.

| File | Source | Source time |
| --- | --- | --- |
| `hko-2026-09-13.json` | [HKO current weather](https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en) | Report 14:02 HKT; temperature/humidity 14:00 HKT; icon 13:45 HKT |
| `mtr-isl-adm-2026-09-13.json` | [MTR ISL Admiralty](https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=ISL&sta=ADM) | Data 14:16:44 HKT; system 14:16:54 HKT |

The fixture mode preserves these timestamps. They will naturally become stale. Tests inject an explicit clock near capture time; they do not modify the recorded source time. Other station fixtures are unavailable until captured separately.

Primary references: [HKO API documentation](https://data.weather.gov.hk/weatherAPI/doc/HKO_Open_Data_API_Documentation.pdf), [HKO icon meanings](https://www.hko.gov.hk/textonly/v2/explain/wxicon_e.htm), [MTR dataset](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data), [MTR data dictionary](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf).

`kmb-1a-2026-09-13.json` is a recorded subset of the official KMB route catalogue, route 1A outbound stops, their stop details and an ETA response. Original provider timestamps are preserved. It is used only in injected provider/API tests, not by runtime fixture mode.
