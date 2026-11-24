package main
import("bytes";"encoding/json";"fmt";"html";"html/template";"os";"path/filepath";"strings";"unicode/utf8")
type Brand struct{ID string `json:"id"`; Name string `json:"name"`; URLs []string `json:"urls"`}
func must(ok bool,message string){if !ok{panic(message)}}
func execute(file string,data map[string]any)string{raw,e:=os.ReadFile(file);if e!=nil{panic(e)};t,e:=template.New(file).Parse(string(raw));if e!=nil{panic(e)};var out bytes.Buffer;if e=t.Execute(&out,data);e!=nil{panic(e)};return out.String()}
func main(){root:="supabase/email-templates";raw,e:=os.ReadFile(filepath.Join(root,"brands.json"));if e!=nil{panic(e)};var brands []Brand;if e=json.Unmarshal(raw,&brands);e!=nil{panic(e)};tests:=0
 for _,flow:=range []string{"invite","magic-link"}{subjectRaw,_:=os.ReadFile(filepath.Join(root,flow+"-subject.txt"));must(utf8.RuneCount(subjectRaw)<=255,"Subject template exceeds Supabase limit");for _,b:=range brands{for _,url:=range b.URLs{
 link:="https://test.supabase.co/auth/v1/verify?token=CONTROLLED_TEST&type=invite&redirect_to="+url
 data:=map[string]any{"RedirectTo":url,"ConfirmationURL":link,"Data":map[string]any{"app":"forged-app"}}
 prefix:="Invitație de acces – ";cta:="Activează contul";if flow=="magic-link"{prefix="Conectare securizată – ";cta="Conectează-te"};subject:=execute(filepath.Join(root,flow+"-subject.txt"),data);body:=execute(filepath.Join(root,flow+".html"),data)
 must(subject==prefix+b.Name,"Wrong subject: "+url);must(strings.Contains(body,"<title>"+prefix+b.Name+"</title>"),"Wrong brand");must(strings.Contains(body,"email-assets/"+b.ID+"-v1.png"),"Wrong logo");must(strings.Contains(body,`href="`+html.EscapeString(link)+`"`),"Activation URL modified");must(strings.Contains(body,cta),"Missing CTA");must(!strings.Contains(body,"forged-app"),"Metadata overrides branding");must(!strings.Contains(body,"ZgotmplZ"),"Unsafe HTML URL");must(len(body)<15000,"Oversized rendered email");tests++
 }}
 unknown:=map[string]any{"RedirectTo":"https://untrusted.example/mycar/","ConfirmationURL":"https://test.supabase.co/auth/v1/verify?token=CONTROLLED_TEST","Data":map[string]any{"app":"mycar"}}
 body:=execute(filepath.Join(root,flow+".html"),unknown);must(!strings.Contains(body,"email-assets/"),"Unknown origin selected a brand");must(strings.Contains(body,".supabase.co/auth/v1/verify"),"Fallback lost link");tests++
 }
 // Render safe offline previews from the same Go engine; never send mail or create users.
 os.MkdirAll("/workspace/mail-template-qa/dist",0755)
 for _,b:=range brands{body:=execute(filepath.Join(root,"invite.html"),map[string]any{"RedirectTo":b.URLs[0],"ConfirmationURL":"https://example.invalid/controlled-preview"});os.WriteFile("/workspace/mail-template-qa/dist/"+b.ID+".html",[]byte(body),0644)}
 fmt.Printf("PASS: %d Go-template cases; correct subjects, branding, exact activation links, neutral fallback, metadata isolation. No emails sent.\n",tests)
}
