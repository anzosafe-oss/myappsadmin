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

## Anonimous — v1.3.0

Administrare din contul global autorizat: profiluri, invitații, retrimitere, retragere și reinvitare. Serviciul `anonymous-admin` rulează în proiectul MyGames și verifică identitatea și rolul administratorului în proiectul principal. `supabase/anonymous-access-control.sql` păstrează profilurile existente și izolează accesul de celelalte aplicații. Programările nu sunt șterse la retragerea accesului. Aliasul se personalizează din setările agendei.

## Eliminarea adreselor din listă — v1.4.0

După retragerea accesului sau anularea invitației, administratorul poate elimina adresa din lista aplicației. Marcajele se păstrează server-side în `myapps_admin_hidden`, separat pentru fiecare aplicație. Nu se șterg utilizatori Auth, apartenențe sau date. Invitarea din nou șterge marcajul; accesul activ sau în așteptare nu poate fi ascuns. SQL-ul se aplică în ambele proiecte: `supabase/admin-hidden-emails.sql`.

## Invitații personalizate — v1.5.0

Gmail SMTP și toate funcțiile Auth rămân neschimbate. Cele patru template-uri sunt generate de `scripts/build-email-templates.cjs`, cu logo-uri reale din aplicații, copiate în `email-assets/`. Anonymous folosește logo-ul inline WEBP din repository-ul său, convertit lossless în PNG pentru compatibilitate email.

În ambele proiecte Supabase, **Emails → Invite user** folosește `supabase/email-templates/invite.html` și `invite-subject.txt`; **Magic link or OTP** folosește `magic-link.html` și `magic-link-subject.txt`, pentru invitații către identități deja existente. Selecția folosește numai destinații exacte `.RedirectTo` din `brands.json`, inclusiv adresele istorice și preview-ul MyList. Destinațiile necunoscute primesc un mesaj neutru, cu linkul Supabase original. Butonul și alternativa text folosesc exclusiv `{{ .ConfirmationURL }}`. Nu se alege identitatea din metadata editabilă a utilizatorului. Resetarea parolei, confirmarea înregistrării și notificările de securitate nu se modifică.

Regenerare: `node scripts/build-email-templates.cjs`. Verificare cu motorul real Supabase/Go: `go run scripts/verify-email-templates.go`; apoi `node --test tests/*.test.cjs`. Testele folosesc linkuri fictive, nu creează conturi și nu trimit emailuri.

Testele locale verifică structura, randarea responsive și compatibilitatea sintactică Go. Livrarea Gmail SMTP și afișarea în aplicațiile reale Gmail/Outlook/iOS Mail necesită testare pe destinatari autorizați; aceste teste nu se execută fără aprobare.

Subiectul folosește o formulă compactă de 223 de caractere pentru limita Supabase de 255; identifică ruta aplicației și adresa istorică de preview MyList. Această etichetă este exclusiv cosmetică. Designul, CTA-ul și fallback-ul se aleg în continuare prin compararea adresei complete, fără acces acordat pe baza subiectului.

## Administrarea conturilor MyList — v1.5.1

Tabul Conturi include accesul retras până la „Elimină din listă”. Administratorul global poate retrage și accesul administratorilor de familie; conturile globale `is_admin` rămân protejate. RPC-ul `mylist_admin_revoke_account` verifică din nou rolul administrativ în baza de date, retrage autorizarea și partajările primite, anulează invitațiile și eliberează locul. Listele, produsele, profilul și identitatea Auth se păstrează. Dacă persoana conduce familia, `admin_id` devine null; ceilalți membri își păstrează accesul, iar reinvitarea proprietarului poate restabili rolul. Pentru conturi istorice fără invitație se păstrează un marcaj cancelled cu zero trimiteri. Eliminarea ascunde doar adresa din MyAppsAdmin, separat pentru MyList. Nu se trimit emailuri prin retragere sau eliminare.

## Emailuri Auth și alias la activare — v1.6.0

Template-uri pentru toate cele șase evenimente Auth. Cele cinci evenimente cu destinație cunoscută folosesc identitatea aplicației; reautentificarea folosește un singur mesaj MyAppsAdmin cu Token. MyList include iconul și wordmark-ul originale. Gmail SMTP, URL-urile securizate și parolele existente nu sunt modificate. Sursele active sunt în supabase/email-templates. Generatorul `node scripts/build-auth-email-preview.cjs --active-files` regenerează fișierele active; fără flag produce doar preview. Comanda istorică `node scripts/build-email-templates.cjs` folosește același generator complet; maparea de nume pentru Supabase este documentată în auth-email-draft/README.md.
