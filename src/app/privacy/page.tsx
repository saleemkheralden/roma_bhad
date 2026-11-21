import Link from "next/link";
import { BoardHeader } from "@/components/board";

export const metadata = { title: "מדיניות פרטיות" };

const CONTACT = "roma.d.standard@gmail.com";
const UPDATED = "19.11.2026";

// Public page (no sign-in): required by Google for the OAuth consent screen.
export default function PrivacyPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <BoardHeader />
      <article className="mx-auto w-full max-w-2xl px-4 py-8 text-base leading-relaxed [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-extrabold [&_li]:ms-5 [&_li]:list-disc [&_p]:mb-3">
        <h1 className="text-2xl font-extrabold">מדיניות פרטיות — רומא</h1>
        <p className="text-sm text-ink-2">עודכן לאחרונה: {UPDATED}</p>

        <p>
          רומא היא אפליקציה לצוותים בקורס, שמרכזת במקום אחד את רשימת הצוות, הנוכחות, המשימות, הקישורים ויומן הצוות.
          האפליקציה לא מסווגת, ואסור להכניס אליה מידע מבצעי.
        </p>

        <h2>איזה מידע נשמר</h2>
        <ul>
          <li>שם וכתובת מייל של חשבון ההתחברות (Google או מייל).</li>
          <li>שמות חברי הצוות, תפקידים ושיבוצים.</li>
          <li>סטטוס נוכחות וסיבה קצרה.</li>
          <li>טקסט של משימות, תאריכי יעד וסימוני ביצוע.</li>
          <li>קישורים ומזהי יומן Google שהצוות הוסיף.</li>
        </ul>
        <p>לא נשמרים: מיקומים, מספרים אישיים או תעודות זהות, מידע רפואי או כל מידע מבצעי.</p>

        <h2>יומן Google</h2>
        <p>
          כשצוות מחבר יומן, רומא קוראת ממנו רק את כותרות האירועים ושעותיהם (הרשאת קריאה בלבד), כדי להציג אותם לחברי הצוות.
          מיקום ותיאור האירועים לא נקראים. האירועים לא נשמרים במסד הנתונים, רק נשמרים בזיכרון לכדקה.
        </p>

        <h2>מי רואה מה</h2>
        <p>
          רק חברי הצוות רואים את המידע של הצוות. משימות פרטיות גלויות רק למי שיצר אותן. ההרשאות נאכפות במסד הנתונים.
        </p>

        <h2>שיתוף עם אחרים</h2>
        <p>
          המידע לא נמכר ולא משותף. אין באפליקציה כלי אנליטיקה או מעקב. השירות מאוחסן אצל Supabase (מסד נתונים, אירופה)
          ו-Vercel (אירוח).
        </p>

        <h2>מחיקת מידע</h2>
        <p>
          כל חבר/ה בצוות יכול/ה להוריד בכל רגע את הנתונים שלו/ה מעמוד הצוות. אחראי/ת הצוות יכול/ה להוריד את כל נתוני
          הצוות ולמחוק את הצוות לצמיתות, כולל כל מה שבו.
        </p>
        <p>
          אפשר לבקש מחיקה של החשבון ושל כל המידע שלו בכתובת{" "}
          <a href={`mailto:${CONTACT}`} className="font-bold underline" dir="ltr">
            {CONTACT}
          </a>
          . אפשר גם לבטל בכל רגע את הגישה של רומא לחשבון Google בהגדרות החשבון (אבטחה ← חיבורים לצד שלישי).
        </p>

        <hr className="my-10 border-rule" />

        <section dir="ltr" lang="en" className="text-start">
          <h2>Privacy Policy (English)</h2>
          <p>
            Roma is an unclassified team tool for course cadets: roster, roll call, tasks, links and the team calendar.
          </p>
          <p>
            <strong>Data stored:</strong> the sign-in name and email; team member names, roles and assignments; attendance
            status with a short reason; task text and due dates; links and Google Calendar IDs added by the team. No
            locations, ID numbers, medical or operational data.
          </p>
          <p>
            <strong>Google user data:</strong> with read-only calendar access, Roma reads only event titles and times
            from calendars a team connects, to show them to that team. Event locations and descriptions are not
            requested. Events are not stored; they are kept in memory for about a minute. Roma&apos;s use and transfer of
            information received from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="font-bold underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <p>
            <strong>Sharing:</strong> data is never sold or shared. No analytics or trackers. Hosted on Supabase (EU) and
            Vercel.
          </p>
          <p>
            <strong>Deletion and contact:</strong>{" "}
            <a href={`mailto:${CONTACT}`} className="font-bold underline">
              {CONTACT}
            </a>
            . You can revoke Roma&apos;s access to your Google account at any time in your Google Account settings.
          </p>
          <p className="text-sm text-ink-2">Last updated: November 19, 2026</p>
        </section>

        <p className="mt-10">
          <Link href="/login" className="font-bold underline">
            חזרה לכניסה
          </Link>
        </p>
      </article>
    </main>
  );
}
