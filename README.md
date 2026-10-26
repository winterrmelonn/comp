tracking community service hours has been the greatest pain. in fact, I just fell for a fake captcha which led me to install malware, because our school's Baron News website was compromised. the official FVHS spreadsheet for tracking hours for the 160 hour community service cord isn't on the official FVHS website; it was linked in a Baron News article that, got me a virus.

the app does multiple things:
1. connects clubs & their volunteer events to students
  - club rush happens for two lunches at the beginning of each semester, then never again. the typical student joins one or two clubs, and misses all of the opportunities the other 80 provide. comp will create a space not only for club leaders to promote their events, resulting in higher yields, but also a space for students to find those opportunities to begin with. students aiming to clear their 160 hours in a shorter amount of time, or students who want to find a greater range of volunteering events stand to benefit.
2. logs hours & events in one place
  - a spreadsheet is a pain to update and a pain to keep organized. one column for how many hours you where there, another describing the event, another for the club, and no space for a group picture. comp is like Instagram; every event attended is logged with hours, approval from a supervisor, and a picture to affirm and commemorate the event.
3. social media for clubs
  - club on club collaboration is rare and typically happens between friends. social media is informal and hard to manage between groups. comp creates that space for club leaders to connect.
4. club tracking
  - similar to volunteer hours, club leaders may find tracking membership and participation equally tedious and chaotic. comp will have organization tabs similar to those on Linkedin, where members with comp accounts are listed under that club. this feature could also be used to track participation from member to member, and to create a member leaderboard within clubs, and a club leaderboard between clubs. (ranked on volunteer hours, member count, etc.)
5. reverse doomscrolling
  - scholarships & extracurricular opportunities; comp will have a feed feature where devs and club leaders can post about scholarship & non-volunteer extracurricular opportunities. (a good example would be stardance for hack club.) 
6. college application hub
  - fafsa, transcripts, letters of recs, activities list, piqs, common app essays; multiple aspects of a college application that takes 25 tabs and 64 gb of ram. multiple different application websites and a million things to keep track of. comp keeps it all in one place, possibly with a timeline feature.

  LIVE DEPLOYMENT AT: https://winterrmelonn.github.io/comp/

## Run

No build step. Serve the folder (e.g. `python3 -m http.server 8123`) and open http://localhost:8123.

Accounts, hours, clubs and posts live in Supabase (project URL and publishable key in `db.js`). To set up a fresh project, run the `supabase*.sql` files in order (`supabase.sql`, then `supabase-2.sql` … `supabase-7.sql`) in Supabase → SQL Editor.

Guests can still log hours without an account; those stay in the browser's localStorage and can be moved into an account from the profile page. **Download CSV** gives you a backup.

## Test

```
node test.js
```
