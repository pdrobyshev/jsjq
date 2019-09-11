"use strict";

const gulp = require('gulp');
const plumber = require('gulp-plumber');
const sourcemap = require('gulp-sourcemaps');
const sass = require('gulp-sass');
const postcss = require('gulp-postcss');
const concat = require('gulp-concat');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');
const autoprefixer = require('autoprefixer');
const server = require('browser-sync').create();
const csso = require('gulp-csso');
const rename = require('gulp-rename');
const imagemin = require('gulp-imagemin');
const webp = require('gulp-webp');
const svgstore = require('gulp-svgstore');
const del = require('del');

/**
 * Полное удаление папки build
 */
gulp.task('clean', function () {
  return del('build');
});

/**
 * Копируем все необходимые файлы из папки source в build
 */
gulp.task('copy', function () {
  return gulp.src([
    'source/fonts/**/*.{woff,woff2}',
    'source/img/**',
    'source/js/**',
    'source/slick/**',
    'source/*.ico'
  ], {
    base: 'source'
  })
      .pipe(gulp.dest('build'));
});

gulp.task('copy-js', function () {
  return gulp.src('source/js/**', { base: 'source' })
      .pipe(gulp.dest('build'));
});

/**
 * Копируем необходимые библиотеки для вёрстки
 */
gulp.task('copy-js-libs', function () {
  return gulp.src([
    'node_modules/picturefill/dist/picturefill.min.js',
    'node_modules/svg4everybody/dist/svg4everybody.min.js'
  ])
      .pipe(gulp.dest('build/js'));
});

/**
 * 1. Берём файл style.scss из папки source
 * 2. Plumber при возникновении ошибки выводит её в консоль и поток переходит на следующий pipe,
 *    то есть работа не останавливается
 * 3. sass() компилирует scss в css
 * 4. Плагин postcss благодаря плагину autoprefixer расставляет необходимые вендорные префиксы
 * 5. Файл style.css падает в build/css
 * 6. Минифицируем файл
 * 7. Переименовываем в style.min.css
 * 8. Запускаем sourcemap, чтобы в dev tools можно было видеть в каком scss файле лежат конкретные стили
 * 9. Кладём минифицированный и переименованный style.min.css в build/css
 */
gulp.task('css', function () {
  return gulp.src('source/sass/style.scss')
      .pipe(plumber())
      .pipe(sourcemap.init())
      .pipe(sass())
      .pipe(postcss([autoprefixer()]))
      .pipe(gulp.dest('build/css'))
      .pipe(csso())
      .pipe(rename('style.min.css'))
      .pipe(sourcemap.write('.'))
      .pipe(gulp.dest('build/css'));
});

/**
 * 1. Берём только те скрипты из build/js которые хотим собрать в один
 * 2. Конкатенируем их в scripts.js
 * 3. Конвертируем из ES6 в ES5
 * 4. Минифицируем
 * 5. Переименовываем в scripts.min.js
 * 6. Кладём обратно в build js
 */
gulp.task('common-scripts', function () {
  return gulp.src([
    'build/js/common.js',
    'build/js/httpAsync.js',
    'build/js/modals.js'
  ])
      .pipe(plumber())
      .pipe(sourcemap.init())
      .pipe(concat('scripts.js'))
      .pipe(gulp.dest('build/js'))
      .pipe(babel({
        presets: ['@babel/preset-env']
      }))
      .pipe(uglify())
      .pipe(rename('scripts.min.js'))
      .pipe(gulp.dest('build/js'));
});

/**
 * 1. Берём все скрипты из build/js, кроме scripts.js и scripts.min.js
 * 2. Конвертируем каждый файл из ES6 в ES5
 * 3. Минифицируем каждый файл
 * 4. Переименовываем каждый файл, добавляем .min в название
 * 5. Кладём обратно в build/js
 */
gulp.task('every-script', function () {
  return gulp.src([
    'build/js/**/*.js',
    '!build/js/scripts.js',
    '!build/js/scripts.min.js'
  ])
      .pipe(plumber())
      .pipe(sourcemap.init())
      .pipe(babel({
        presets: ['@babel/preset-env']
      }))
      .pipe(uglify())
      .pipe(rename(function (path) {
        path.basename += '.min';
      }))
      .pipe(gulp.dest('build/js'));
});

/**
 * Перезагрузка страницы
 */
gulp.task('refresh', function (done) {
  server.reload();
  done();
});

/**
 * Запуск локального сервера
 */
gulp.task('server', function () {
  server.init({
    server: 'build/',
    notify: false,
    open: true,
    cors: true,
    ui: false
  });

  /**
   * watch'еры следят за изменениями в файлах
   * Если изменения есть - происходит вызов тасков, указанных в gulp.series
   * Как правило если есть изменения в css/js файлах -
   * то мы снова компилируем/минифицируем/копируем их и перезагружаем страницу,
   * чтобы сразу увидеть изменения
   */
  gulp.watch('source/sass/**/*.{scss,sass}', gulp.series('css', 'refresh'));
  gulp.watch('source/js/**/*.js', gulp.series('copy-js', 'refresh'));
  gulp.watch('source/img/icon-*.svg', gulp.series('create-sprite', 'copy-html', 'refresh'));
  gulp.watch('source/*.html', gulp.series('copy-html', 'refresh'));
});

/**
 * Оптимизируем картинки из build/img и кладём туда же
 */
gulp.task('optimize-images', function () {
  return gulp.src('build/img/**/*.{png,jpg,svg}')
      .pipe(imagemin([
        imagemin.optipng({optimizationLevel: 3}),
        imagemin.jpegtran({progressive: true}),
        imagemin.svgo()
      ]))
      .pipe(gulp.dest('build/img'))
});

/**
 * Конвертируем из png и jpg в формат WebP
 */
gulp.task('convert-to-webp', function () {
  return gulp.src('source/img/**/*.{png,jpg}')
      .pipe(webp({quality: 90}))
      .pipe(gulp.dest('source/img'))
});

/**
 * Создаём спрайт из файлов начинающихся на icon- в build/img и кладём спрайт туда же
 */
gulp.task('create-sprite', function () {
  return gulp.src([
    'build/img/icons/icon-*.svg'
  ])
      .pipe(svgstore({
        inlineSvg: true
      }))
      .pipe(rename('sprite.svg'))
      .pipe(gulp.dest('build/img'))
});

/**
 * Копируем html файлы из source в build
 */
gulp.task('copy-html', function () {
  return gulp.src('source/*.html')
      .pipe(gulp.dest('build'))
});

/**
 * 1. Удаляем папку build
 * 2. Копируем папки fonts, img, js с файлами в них из source в папку build
 * 3. Копируем js библиотеки, необходимые для правки косяков в старых браузерах
 * 4. Конкатенация js файлов и их минификация
 * 5. Минификация каждого отдельного js файла, КРОМЕ scripts.js и scripts.min.js
 * 6. Копируем html файлы из source в build
 */
gulp.task('dev-build', gulp.series(
    'clean',
    'copy',
    // 'copy-js-libs',
    'css',
    // 'common-scripts',
    // 'every-script',
    // 'create-sprite',
    'copy-html'
));

/**
 * То же самое, что и таск dev-build, но здесь добавляется:
 * 1. Конвертация png и jpg картинок в формат WebP
 * 2. Оптимизация всех картинок в папке build/img
 * 3. Создание спрайта
 */
gulp.task('build', gulp.series(
    'clean',
    'convert-to-webp',
    'copy',
    'copy-js-libs',
    'css',
    'common-scripts',
    'every-script',
    'optimize-images',
    'create-sprite',
    'copy-html'
));

/**
 * Таск, который последовательно запускает несколько других тасков
 */
gulp.task('start', gulp.series('dev-build', 'server'));


/**
 * Создаём структуру папок для нового проекта
 */
gulp.task('structure', function () {
  return gulp.src('*.*', {read: false})
      .pipe(gulp.dest('source'))
      .pipe(gulp.dest('source/css'))
      .pipe(gulp.dest('source/fonts'))
      .pipe(gulp.dest('source/img'))
      .pipe(gulp.dest('source/js'))
      .pipe(gulp.dest('source/sass'))
      .pipe(gulp.dest('source/sass/blocks'));
});