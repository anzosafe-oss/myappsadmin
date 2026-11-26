# AGENTS.md — MyAppsAdmin

## Priorități și continuitate
- Prioritizează calitatea, stabilitatea și experiența utilizatorului înaintea economiei de tokeni.
- Păstrează coerența vizuală și funcțională între aplicațiile ecosistemului MyApps și respectă convențiile de design și funcționalitate stabilite anterior.
- Păstrează integral funcționalitățile existente care nu fac obiectul solicitării. Evită refactorizările fără legătură cu aceasta; alege modificările necesare pentru o soluție completă și stabilă.

## Analiză și resurse
- Citește acest fișier înainte de orice intervenție. Începe analiza în `anzosafe-oss/myappsadmin`, folosind căi cunoscute și căutări țintite în fișierele și dependențele relevante.
- Consultă alte repository-uri sau proiecte Supabase atunci când sunt necesare solicitării ori verificării unei dependențe. Nu efectua căutări generale sau inventarieri fără legătură cu lucrarea.
- Când utilizatorul face referire la o altă aplicație, consultă implementarea reală a acesteia și reutilizează soluția validată, adaptând-o aplicației curente.
- Evită investigațiile redundante și verificările repetate fără motiv, fără a compromite calitatea implementării sau testării. Extinde analiza când este necesar pentru rezolvarea și validarea completă a problemei.
- În Supabase, verifică identificatorii necunoscuți înainte de utilizare și accesează resursele relevante pentru sarcină. Nu expune secrete.

## Date și întreținere
- Datele demonstrative sunt permise exclusiv în preview și în mediile de testare. La prima publicare, aplicația LIVE trebuie să fie curată, fără date demonstrative.
- La actualizările ulterioare, păstrează integral datele reale ale utilizatorilor; nu le șterge și nu le înlocui cu date demonstrative.
- Elimină fișierele, resursele sau codul devenite inutile numai după verificarea dependențelor, inclusiv referințe dinamice, manifest, service worker, cache și configurația de publicare.
- Păstrează curățarea în limitele intervenției. Nu șterge resurse cu utilizare incertă și nu rescrie istoricul Git.

## Validare și publicare
- Rulează verificările și testele relevante pentru modificare și riscurile ei, inclusiv regresiile necesare. Verifică compatibilitatea cu iOS, Android și desktop; raportează comportamentele netestate și eventualele blocaje.
- Pregătește modificările pe o ramură separată. Publică în producție numai cu acordul explicit al utilizatorului.
- Actualizează versiunea aplicației la publicare, respectând convențiile existente.
- Raportează concis fișierele modificate, rezultatele verificărilor, limitările și deciziile relevante.
