/* =========================================================
   Happy Stacyland — скрипти сайту
   1. Шапка (фон при прокручуванні, мобільне меню)
   2. Hero: собаки стежать поглядом за курсором-кісточкою
   3. Hero: дудли рухаються за курсором (паралакс)
   4. Поява блоків при прокручуванні
   5. Форми (анкета, чек-лист)
   6. Слайдер відгуків
   7. Плаваюча кнопка на телефоні
   8. Квіз «Чи підходить вам цвергпінчер?»
   ========================================================= */

/* Налаштування сайту.
   formEndpoint — адреса, куди надсилаються заявки з форм.
   Поки порожня, форми показують запасне повідомлення.
   Після переходу на Vercel: '/api/lead' (функція site/api/lead.js пересилає заявки в Telegram). */
var SITE = {
  formEndpoint: '',                                             /* ЗМІНИТИ після підключення Vercel */
  instagram: 'https://instagram.com/anactacya_happy_stacyland'
};

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Шапка ---------- */
  var header = document.getElementById('header');
  var burger = document.querySelector('.burger');
  var mobileMenu = document.getElementById('mobile-menu');
  /* На внутрішніх сторінках (без Hero) шапка завжди біла */
  var solidHeader = header && header.hasAttribute('data-solid');

  function onScroll() {
    header.classList.toggle('header--scrolled', solidHeader || window.scrollY > 40);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    mobileMenu.classList.toggle('mobile-menu--open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (burger && mobileMenu) {
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    mobileMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
  }

  /* ---------- 2. Hero: погляд за кісточкою ---------- */
  var HERO = {
    framePath: 'assets/hero/frame-',  /* ЗМІНИТИ, якщо кадри лежать в іншій папці */
    frameCount: 31,                   /* кількість кадрів (00…30) */
    frameWidth: 1280,
    frameHeight: 720,
    dogsX: 0.66,                      /* де в кадрі собаки по горизонталі (0 — ліво, 1 — право) */
    followSpeed: 0.12,                /* плавність стеження (менше — повільніше) */
    introSpeed: 0.045,                /* швидкість першого повороту при завантаженні */
    introDelay: 500,                  /* пауза перед першим поворотом, мс */
    returnDelay: 1400                 /* через скільки мс після дотику собаки знову дивляться на вас */
  };

  var hero = document.getElementById('hero');
  var canvas = hero && hero.querySelector('.hero__canvas');
  var poster = hero && hero.querySelector('.hero__poster');
  var hint = hero && hero.querySelector('.hero__hint');

  if (hero && canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var frames = [];
    var current = 0;           /* поточний «поворот голови»: 0 — ліворуч, 1 — в камеру */
    var target = 0;
    var speed = HERO.introSpeed;
    var drawnIndex = -1;
    var running = false;
    var heroVisible = true;
    var ready = false;
    var returnTimer = null;
    var hintDistance = 0;
    var lastPointer = null;

    /* Завантажуємо всі кадри */
    var loads = [];
    for (var i = 0; i < HERO.frameCount; i++) {
      var img = new Image();
      img.decoding = 'async';
      img.src = HERO.framePath + String(i).padStart(2, '0') + '.webp';
      frames.push(img);
      loads.push(img.decode ? img.decode().catch(function () {}) : Promise.resolve());
    }

    /* Читаємо object-position з CSS, щоб canvas кадрував так само, як <img> */
    function getFocus() {
      var pos = getComputedStyle(poster).objectPosition.split(' ');
      return { x: parseFloat(pos[0]) / 100 || 0.5, y: parseFloat(pos[1]) / 100 || 0.5 };
    }

    var layout = {};
    function resize() {
      /* Розмір і місце canvas задає CSS (десктоп — праворуч унизу, мобільний — на весь екран) */
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var box = canvas.getBoundingClientRect();
      var heroBox = hero.getBoundingClientRect();
      var w = box.width;
      var h = box.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      var scale = Math.max(w / HERO.frameWidth, h / HERO.frameHeight);
      var focus = getFocus();
      var visibleW = w / scale;
      var visibleH = h / scale;
      layout = {
        sx: (HERO.frameWidth - visibleW) * focus.x,
        sy: (HERO.frameHeight - visibleH) * focus.y,
        sw: visibleW,
        sh: visibleH,
        scale: scale
      };
      /* Де на екрані (відносно Hero) знаходяться собаки */
      layout.dogsScreenX = (box.left - heroBox.left) + (HERO.frameWidth * HERO.dogsX - layout.sx) * scale;
      drawnIndex = -1;
      draw();
    }

    function draw() {
      if (!ready) return;
      var index = Math.round(current * (HERO.frameCount - 1));
      if (index === drawnIndex) return;
      var frame = frames[index];
      if (!frame || !frame.complete) return;
      ctx.drawImage(frame, layout.sx, layout.sy, layout.sw, layout.sh, 0, 0, canvas.width, canvas.height);
      drawnIndex = index;
    }

    var lastTime = 0;
    function tick(now) {
      /* Плавність не залежить від частоти кадрів пристрою */
      var dt = lastTime ? Math.min(now - lastTime, 100) : 16.7;
      lastTime = now;
      current += (target - current) * (1 - Math.pow(1 - speed, dt / 16.7));
      if (Math.abs(target - current) < 0.002) current = target;
      draw();
      if (current !== target && heroVisible) {
        requestAnimationFrame(tick);
      } else {
        running = false;
      }
    }
    function start() {
      if (!running && ready && heroVisible) {
        running = true;
        lastTime = 0;
        requestAnimationFrame(tick);
      }
    }

    /* Позиція курсора → куди дивляться собаки */
    function lookAt(clientX) {
      var rect = hero.getBoundingClientRect();
      var x = clientX - rect.left;
      var p = x / Math.max(layout.dogsScreenX - rect.width * 0.04, 1);
      p = Math.min(Math.max(p, 0), 1);
      target = Math.pow(p, 1.15);
      speed = HERO.followSpeed;
      start();
    }
    function lookAtVisitor() {
      target = 1;
      speed = HERO.introSpeed * 1.5;
      start();
    }

    hero.addEventListener('pointermove', function (e) {
      if (!ready) return;
      clearTimeout(returnTimer);
      lookAt(e.clientX);

      /* Ховаємо підказку, коли людина «пограла» кісточкою */
      if (hint && lastPointer) {
        hintDistance += Math.abs(e.clientX - lastPointer.x) + Math.abs(e.clientY - lastPointer.y);
        if (hintDistance > 600) hint.classList.add('hero__hint--hidden');
      }
      lastPointer = { x: e.clientX, y: e.clientY };
    });

    hero.addEventListener('pointerleave', function () {
      if (!ready) return;
      returnTimer = setTimeout(lookAtVisitor, 300);
    });

    /* Мобільний: дотик ліворуч — собаки дивляться туди, потім знову на вас */
    hero.addEventListener('pointerdown', function (e) {
      if (!ready || e.pointerType === 'mouse') return;
      clearTimeout(returnTimer);
      lookAt(e.clientX);
    });
    hero.addEventListener('pointerup', function (e) {
      if (!ready || e.pointerType === 'mouse') return;
      returnTimer = setTimeout(lookAtVisitor, HERO.returnDelay);
    });

    /* Не анімуємо, коли Hero не видно */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
        if (heroVisible) start();
      }).observe(hero);
    }

    window.addEventListener('resize', resize);

    /* Коли кадри завантажились — показуємо canvas і робимо перший поворот «на вас» */
    Promise.all(loads).then(function () {
      ready = true;
      resize();
      canvas.classList.add('hero__canvas--ready');
      if (reduceMotion) {
        current = target = 1;
        drawnIndex = -1;
        draw();
        return;
      }
      setTimeout(function () {
        if (target === 0 && current === 0) {
          target = 1;
          speed = HERO.introSpeed;
          start();
        }
      }, HERO.introDelay);
    });
  }

  /* ---------- 3. Hero: дудли за курсором ---------- */
  var doodles = hero ? hero.querySelectorAll('[data-depth]') : [];
  if (doodles.length && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    var pending = false;
    var mx = 0;
    var my = 0;
    hero.addEventListener('pointermove', function (e) {
      var rect = hero.getBoundingClientRect();
      mx = (e.clientX - rect.left) / rect.width - 0.5;
      my = (e.clientY - rect.top) / rect.height - 0.5;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        doodles.forEach(function (el) {
          var d = parseFloat(el.dataset.depth);
          el.style.transform = 'translate3d(' + (mx * d) + 'px,' + (my * d) + 'px,0)';
        });
        pending = false;
      });
    });
  }

  /* ---------- 4. Поява блоків при прокручуванні ---------- */
  var revealItems = document.querySelectorAll('[data-reveal]');
  if (revealItems.length && 'IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealItems.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- 5. Форми (анкета, чек-лист) ---------- */
  function setStatus(el, type, html) {
    if (!el) return;
    el.className = 'form__status form__status--' + type;
    el.innerHTML = html;
  }

  /* Відповіді анкети одним текстом — щоб людина могла надіслати їх у месенджер,
     поки прийом заявок не підключено */
  function formToText(form) {
    var lines = [];
    form.querySelectorAll('[name]').forEach(function (f) {
      if (f.name === 'website' || f.name === 'consent') return;
      if ((f.type === 'radio' || f.type === 'checkbox') && !f.checked) return;
      var value = (f.value || '').trim();
      if (!value) return;
      var group = f.closest('.field');
      var label = group && group.querySelector('.field__label');
      var title = label ? label.textContent.replace(/\*|\(.*?\)/g, '').trim() : f.name;
      lines.push(title + ': ' + value);
    });
    return lines.join('\n');
  }

  function sendLead(payload) {
    if (!SITE.formEndpoint) return Promise.resolve({ fallback: true });
    return fetch(SITE.formEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('send failed');
      return { fallback: false };
    });
  }

  document.querySelectorAll('[data-lead-form]').forEach(function (form) {
    var status = form.querySelector('.form__status');
    var button = form.querySelector('[type="submit"]');

    /* Прибираємо помилку, щойно людина виправила поле */
    form.addEventListener('input', function (e) {
      var f = e.target;
      if (f.getAttribute('aria-invalid') === 'true') {
        f.setAttribute('aria-invalid', 'false');
        var err = f.closest('.field') && f.closest('.field').querySelector('.field__error');
        if (err) err.textContent = '';
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      /* Перевірка обов'язкових полів */
      var firstInvalid = null;
      form.querySelectorAll('[required]').forEach(function (f) {
        var valid;
        if (f.type === 'checkbox') valid = f.checked;
        else if (f.type === 'radio') valid = !!form.querySelector('input[name="' + f.name + '"]:checked');
        else valid = f.value.trim() !== '';
        f.setAttribute('aria-invalid', String(!valid));
        var err = f.closest('.field') && f.closest('.field').querySelector('.field__error');
        if (err) err.textContent = valid ? '' : (f.type === 'radio' ? 'Оберіть варіант' : 'Заповніть, будь ласка');
        if (!valid && !firstInvalid) firstInvalid = f;
      });
      if (firstInvalid) {
        setStatus(status, 'error', 'Будь ласка, заповніть позначені поля і погодьтесь з політикою конфіденційності.');
        firstInvalid.focus();
        return;
      }

      /* Пастка для спам-ботів */
      if (form.querySelector('[name="website"]') && form.querySelector('[name="website"]').value) return;

      var data = {};
      new FormData(form).forEach(function (value, key) {
        if (key === 'website') return;
        data[key] = data[key] ? data[key] + ', ' + value : value;
      });

      button.disabled = true;
      sendLead({ form: form.dataset.leadForm, page: location.pathname, data: data })
        .then(function (result) {
          var isGuide = form.dataset.leadForm === 'guide';
          var successUrl = form.dataset.successUrl;

          if (isGuide) {
            try { localStorage.setItem('hs-guide', '1'); } catch (err) { /* без сховища теж працює */ }
            setStatus(status, 'ok', 'Дякуємо! Відкриваємо чек-лист… <a href="' + successUrl + '">Відкрити зараз</a>');
            setTimeout(function () { location.href = successUrl; }, 1200);
            return;
          }

          if (result.fallback) {
            /* Прийом заявок ще не підключено — даємо людині надіслати анкету самій */
            setStatus(status, 'info',
              'Дякуємо! Прийом анкет на сайті ще налаштовується. Щоб ваша анкета не загубилась, ' +
              'скопіюйте відповіді і надішліть їх нам в Instagram.<br><br>' +
              '<button type="button" class="btn btn--small btn--navy" data-copy-answers>Скопіювати відповіді</button> ' +
              '<a class="btn btn--small btn--outline" href="' + SITE.instagram + '" target="_blank" rel="noopener">Відкрити Instagram</a>');
            var copyBtn = status.querySelector('[data-copy-answers]');
            copyBtn.addEventListener('click', function () {
              var text = 'Анкета майбутнього власника (Happy Stacyland)\n\n' + formToText(form);
              (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
                .then(function () { copyBtn.textContent = 'Скопійовано ✓'; })
                .catch(function () { window.prompt('Скопіюйте відповіді:', text); });
            });
            return;
          }

          setStatus(status, 'ok', 'Дякуємо! Ви в листі очікування Happy Stacyland. Я зв\'яжуся з вами найближчим часом.');
          form.reset();
        })
        .catch(function () {
          setStatus(status, 'error', 'Не вдалося надіслати. Спробуйте ще раз або напишіть нам в <a href="' + SITE.instagram + '" target="_blank" rel="noopener">Instagram</a>.');
        })
        .then(function () { button.disabled = false; });
    });
  });

  /* ---------- 6. Слайдер відгуків ---------- */
  document.querySelectorAll('[data-slider]').forEach(function (track) {
    var nav = track.nextElementSibling;
    if (!nav) return;
    function step(dir) {
      var card = track.firstElementChild;
      var amount = card ? card.getBoundingClientRect().width + 20 : 300;
      track.scrollBy({ left: dir * amount, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    var prev = nav.querySelector('[data-slider-prev]');
    var next = nav.querySelector('[data-slider-next]');
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
  });

  /* ---------- 7. Плаваюча кнопка на телефоні ---------- */
  var mobileCta = document.querySelector('.mobile-cta');
  if (mobileCta) {
    var onCtaScroll = function () {
      var nearBottom = window.scrollY + window.innerHeight > document.documentElement.scrollHeight - 900;
      mobileCta.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.9 && !nearBottom);
    };
    onCtaScroll();
    window.addEventListener('scroll', onCtaScroll, { passive: true });
  }

  /* ---------- 8. Квіз «Чи підходить вам цвергпінчер?» ---------- */
  document.querySelectorAll('[data-quiz]').forEach(function (quiz) {
    var steps = quiz.querySelectorAll('.quiz__step');
    var bar = quiz.querySelector('.quiz__bar');
    var count = quiz.querySelector('.quiz__count');
    var score = 0;
    var index = 0;

    function show(i) {
      steps.forEach(function (s, n) { s.classList.toggle('is-active', n === i); });
      if (bar) bar.style.width = (i / steps.length * 100) + '%';
      if (count) count.textContent = 'Питання ' + (i + 1) + ' з ' + steps.length;
    }

    function finish() {
      if (bar) bar.style.width = '100%';
      if (count) count.textContent = 'Ваш результат';
      steps.forEach(function (s) { s.classList.remove('is-active'); });
      /* Результат: багато балів — порода підходить, середньо — з умовами, мало — краще інша порода */
      var max = steps.length * 2;
      var key = score >= max * 0.7 ? 'high' : (score >= max * 0.4 ? 'mid' : 'low');
      var result = quiz.querySelector('.quiz__result[data-result="' + key + '"]');
      if (result) result.classList.add('is-active');
    }

    quiz.addEventListener('click', function (e) {
      var answer = e.target.closest('.quiz__answer');
      if (answer) {
        score += parseInt(answer.dataset.score, 10) || 0;
        index += 1;
        if (index < steps.length) show(index); else finish();
        return;
      }
      if (e.target.closest('[data-quiz-restart]')) {
        score = 0;
        index = 0;
        quiz.querySelectorAll('.quiz__result').forEach(function (r) { r.classList.remove('is-active'); });
        show(0);
      }
    });

    show(0);
  });

  /* ---------- 9. Пінчери-підглядайки ---------- */
  /* Стежимо за блоком-батьком: сама картинка схована за краєм, тож «невидима» для браузера */
  var mascots = document.querySelectorAll('.mascot');
  if (mascots.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      mascots.forEach(function (m) { m.classList.add('is-in'); });
    } else {
      var mascotObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.querySelectorAll(':scope > .mascot').forEach(function (m) { m.classList.add('is-in'); });
          mascotObserver.unobserve(entry.target);
        });
      }, { threshold: 0.25 });
      var roots = new Set();
      mascots.forEach(function (m) { roots.add(m.parentElement); });
      roots.forEach(function (root) { mascotObserver.observe(root); });
    }
  }
})();
