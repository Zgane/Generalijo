# Generali Generator

Osebno orodje za osnutek maila iz police (avto ali dom). PDF se prebere v brskalniku. Mail se **ne pošlje sam**: besedilo kopirate ali ga odprete v svojem poštnem programu.

Pred uporabo na pravi polici preverite pri delodajalcu, ali je obdelava podatkov strank na ta način dovoljena. V repozitoriju ni pravih polic.

## Kako deluje

1. PDF se odpre na napravi (pdf.js je v mapi `vendor/`, brez CDN-ja).
2. Ime, naslov, EMŠO, davčna številka, telefon, e-pošta in IBAN se zakrijejo na napravi. Ime in naslov ostaneta samo za pozdrav in zadevo.
3. V `/api/claude` gre samo zakrito besedilo. Strežnik ga zakrije še enkrat, nato od modela zahteva polja po JSON shemi.
4. Polja preverite ob predogledu PDF-ja. Opozorila označijo na primer premijo 0 € ali prazno registrsko.
5. Po potrditvi se mail sestavi iz predlog v kodi (asistenca L = 500 km, M = 300 km, podpis v `lib/config.js`).

## Zasebnost

Z naprave odide samo zakrito besedilo police (zneski, franšize, kritja, znamka, registrska). PDF, ime, naslov in identifikatorji ostanejo v brskalniku. Dostopni žeton se shrani le za sejo (`sessionStorage`). Stari ključ iz `localStorage` se ob odprtju strani izbriše.

To ni pravni pregled. Pravila zakrivanja ne ujamejo vsake oblike zapisa. Pred klicem odprite »Pokaži, kaj bi odšlo v model«.

## Netlify

Objava je statična mapa repozitorija, funkcija je `netlify/functions/claude.js` na poti `/api/claude`.

Okoljske spremenljivke (Site configuration → Environment variables):

| Ime | Obvezno | Pomen |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | da | Ključ modela. Samo na strežniku. |
| `APP_TOKEN` | da | Dolg naključen žeton, npr. `openssl rand -hex 24`. Isti vnesete v aplikacijo. |
| `ALLOWED_ORIGIN` | priporočeno | Točen izvor strani, npr. `https://ime.netlify.app`, brez poševnice na koncu. Več izvorov ločite z vejico. Vrednost `*` se prezre. Če je prazno, se uporabita Netlify `URL` in `DEPLOY_PRIME_URL`. |
| `ANTHROPIC_MODEL` | ne | Privzeto `claude-sonnet-5-5`. |
| `ANTHROPIC_MAX_TOKENS` | ne | Privzeto `4096` (med 256 in 8192). |

Odjemalec ne more izbrati modela, dolžine odgovora ali lastnega telesa zahteve. CORS dovoli samo nastavljeni izvor. Klici so omejeni na 20 na 10 minut na naslov in na 50.000 znakov zakritega besedila.

## PWA

`manifest.json` je v slovenščini, z ikonami in `share_target`, da lahko PDF z Androida delite v nameščeno aplikacijo. `sw.js` predpomni lupino (omrežje najprej, sicer predpomnilnik) in klicev `/api/` ne shranjuje. Ob spremembi predpomnjenih datotek v `sw.js` povečajte `VERSION`.

Namestitev: stran odprite v brskalniku, po potrebi »Namesti na napravo«, nato jo enkrat zaženite, da se delavec vklopi. Šele nato se PDF lahko deli vanjo.

## Lokalno

```bash
node --test
```

Testi uporabljajo izmišljene police v `test/fixtures/`. Funkcijo v živo preizkusite z `netlify dev`, da so nastavljene iste spremenljivke. Brez njih `/api/claude` vrne, da strežnik še ni nastavljen.

Skeniran PDF brez besedilne plasti se ne prebere. Orodje ne odstranjuje vodnih žigov.
