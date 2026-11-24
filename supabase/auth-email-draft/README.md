# Preview — fără configurare în producție

6 evenimente × 4 aplicații, generate cu `node scripts/build-auth-email-preview.cjs`.
Galeria HTML se generează în `preview/MyAppsAdmin-Emailuri-Preview.html`; este autonomă, cu logo-urile incluse și linkuri demonstrative inactive. Template-urile reale păstrează logo-uri HTTPS din repository și variabilele Supabase.

Confirmare, invitație, magic link/OTP, schimbare email și resetare: selectarea designului după RedirectTo exact, cu fallback neutru. Linkurile se păstrează ca ConfirmationURL; NewEmail este escapata de Go, iar Token este afișat pentru OTP. Subiectele respectă limita Supabase de 255 caractere.

Reautentificare: un singur template MyAppsAdmin (`reauthentication.html`) și subiectul „Cod de verificare – MyAppsAdmin”, identice pentru toate aplicațiile din ambele proiecte. Se folosește exclusiv Token; nu sunt necesare RedirectTo, metadata sau identificarea aplicației. Iconul și culorile sunt cele reale MyAppsAdmin. Gmail SMTP și mecanismul de livrare nu sunt modificate.

MyList: logo complet, compus din iconul original `mylist-icon-v1.png` și wordmark-ul original `mylist-v1.png`. Celelalte identități vizuale sunt păstrate. Galeria conține 20 de mesaje specifice aplicațiilor și un mesaj comun de reautentificare.

Verificare: `go run scripts/verify-auth-email-draft.go`. Nu se trimit emailuri, nu se creează identități persistente și nu se activează aceste template-uri în Supabase înainte de aprobarea preview-ului. Randarea în browser nu înlocuiește testele în clienții reali Gmail/Outlook/iOS Mail.
