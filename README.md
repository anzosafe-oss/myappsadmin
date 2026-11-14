# MyAppsAdmin

Panou comun pentru administrarea MyList, MyCar și MyPet. Identitate vizuală 4B, teme light/dark, iconuri pentru browser și telefon.

## Publicare GitHub Pages

În Settings → Pages, alege **Deploy from a branch**, ramura **main**, directorul **/(root)** și Save. Fișierele statice sunt deja pregătite; nu este necesar un build.

Pagina de autentificare este publică, iar operațiile de administrare necesită autentificarea contului autorizat și verificarea rolului pe server. Nu este necesar un cont ChatGPT pentru versiunea GitHub Pages.

## Funcții disponibile

- MyList: familii, conturi, invitații și retragerea accesului, folosind serviciile existente.
- MyCar: invitații directe, retrimitere, retragerea invitațiilor și a accesului, plus aprobarea/respingerea cererilor existente. Retragerea păstrează datele și nu afectează celelalte aplicații.
- MyPet: conturi, invitații, retrimitere, retragerea accesului și reinvitare. Conturile MyPet sunt separate de MyList/MyCar; carnetele și istoricul se păstrează.

Codul de server este în `supabase/functions/myapps-admin/index.ts`. Componenta principală este publicată în proiectul Supabase folosit de MyList/MyCar. Aceeași funcție este publicată separat în proiectul MyPet; verifică sesiunea și rolul administratorului din proiectul principal înaintea fiecărei operații. Controlul accesului MyCar este descris în `supabase/mycar-access-control.sql`; este separat de MyList și MyPet.

Codul client conține numai chei publicabile. Cheia service-role se citește exclusiv din mediul funcției server; nu adăuga chei secrete în acest repository.

## Verificare

```sh
node --check app.js
node --test tests/admin.test.cjs
```

Versiune: **1.2.0**.

## Iconuri v2

Simbolul 4B este afișat pe fundal verde închis complet opac. Iconul iOS este 180×180, iar Android folosește variante de 192×192 și 512×512, plus icon maskable cu simbolul în zona sigură. Numele fișierelor au sufixul `-v2` pentru actualizarea cache-ului. Iconurile vechi rămân disponibile pentru instalările existente.

Controlul accesului MyPet: `supabase/mypet-access-control.sql`. Verificări izolate cu rollback: `tests/mypet-access-control.sql`. Registrul este accesibil doar serviciului, iar politicile restrictive păstrează regulile existente de proprietate și confirmare a parolei.
