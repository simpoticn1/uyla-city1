ШАБЛОН САЙТА «НАЙДИ СВОЙ ДОМ»

1. Положи выгрузку подписчиков (followers_1.json или .html из Instagram, или .txt со списком ников) в эту папку.
2. Запусти:  python3 make_city.py followers_1.json
   Скрипт создаст js/citydata.js и residents.json (порядок жителей сохраняется между запусками,
   отписавшиеся получают дом без света).
3. Замени название и аккаунт на свои: в index.html и js/app.js найди и замени
   «noctora.city» и «THE LAST CITY» (поиск по папке в любом редакторе, например VS Code: Ctrl+Shift+F).
4. Проверь локально: python3 -m http.server 8000  →  открой http://localhost:8000
5. Выложи: npx vercel deploy --prod  (аккаунт vercel.com, Node.js с nodejs.org).
   В настройках проекта отключи Deployment Protection.
6. Ссылку на сайт поставь в шапку Instagram.

Голосование (api/vote.js) и улучшения домов по приглашениям (api/ref.js) работают на Vercel сами.
Варианты голосования меняются в api/vote.js и в js/app.js (VOTES).
Вопросы — @etototsamyi в Telegram.

--- uyla.city ---
Сайт переведён на узбекский, название UYLA CITY, аккаунт @uyla.city.
Погода — Ташкент. Голосование: Masjid / Choyxona / Bozor / Stadion (свои счётчики «uyla-city-vote»).
Перед выкладкой обязательно запусти make_city.py со своим списком подписчиков: без js/citydata.js сайт не откроется.
