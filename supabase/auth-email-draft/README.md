# Preview — fără configurare în producție

6 evenimente × 4 aplicații, generate cu `node scripts/build-auth-email-preview.cjs`.
Galeria HTML se generează în `preview/MyAppsAdmin-Emailuri-Preview.html`; este autonomă, cu logo-urile incluse și linkuri demonstrative inactive. Template-urile reale păstrează logo-uri HTTPS din repository și variabilele Supabase.

Confirmare, invitație, magic link/OTP, schimbare email și resetare: selectarea designului după RedirectTo exact, cu fallback neutru. Linkurile se păstrează ca ConfirmationURL; NewEmail este escapata de Go, iar Token este afișat pentru OTP. Subiectele respectă limita Supabase de 255 caractere.

Reautentificare: patru variante de design și un fallback neutru. Evenimentul Supabase nu furnizează RedirectTo sau ConfirmationURL. Fără un context explicit al aplicației nu se poate selecta sigur varianta în proiectele comune. Nu se presupune aplicația din SiteURL global și nu se modifică metadata conturilor; soluția de identificare trebuie stabilită înainte de activarea acestui eveniment. Gmail SMTP și mecanismul de livrare nu sunt modificate.

Verificare: `go run scripts/verify-auth-email-draft.go`. Nu se trimit emailuri, nu se creează identități persistente și nu se activează aceste template-uri în Supabase înainte de aprobarea preview-ului. Randarea în browser nu înlocuiește testele în clienții reali Gmail/Outlook/iOS Mail.
