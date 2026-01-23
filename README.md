# VIU Quiz — Aplicación de Tests (Multi-asignatura)

Aplicación web ligera para practicar tests por asignatura. Esta versión soporta varias asignaturas, modos dinámicos y almacenamiento por asignatura en `localStorage`.

## 📚 Asignaturas soportadas (configuradas en `app.js` → `SUBJECTS`)

- `13giin` — 13GIIN - Autómatas (icono: 🤖)
	- Archivo de datos: `data/13bgiin.json`
	- Nota: Modo `ultra` está limitado a 60 preguntas en esta asignatura (por `ultraLimit`).
	- `21giin` — 21GIIN - Proyectos de Programación (icono: 💻)
		- Archivo de datos: `data/21bgiin.json`
	- Nota: `ultra` usa todas las preguntas disponibles.
- `45giin` — 45GIIN - Información WEB (icono: 🌐)
	- Archivo de datos: `data/45giin.json`
	- Nota: `ultra` usa todas las preguntas disponibles.

Si quieres añadir una nueva asignatura, añade una entrada en el objeto `SUBJECTS` dentro de `app.js` apuntando a un archivo JSON similar a los existentes.

## ⚙️ Modos disponibles

Los modos se declaran en `APP_STATE.modeConfig` y el frontend muestra información dinámica según la asignatura cargada.

- `mini` — Mini Test (por defecto 10 preguntas, ajustable si hay menos preguntas)
- `normal` — Normal (por defecto 20 preguntas)
- `pro` — Pro (por defecto 40 preguntas)
- `ultra` — Ultra (incluye todas las preguntas o el `ultraLimit` por asignatura)
- `module` — Módulo (todas las preguntas de un bloque/módulo)
- `review` — Repaso de preguntas falladas

Los conteos y tiempos se ajustan automáticamente según el número total de preguntas de la asignatura (ver `QuizManager.updateModeConfig()`).

## 🗂️ Estructura de los archivos de datos (`data/*.json`)

Cada archivo JSON contiene al menos dos propiedades principales:

- `preguntas`: array de preguntas. Cada pregunta debe incluir campos como:
	- `id`: número único
	- `id_bloque`: identificador numérico del bloque/módulo al que pertenece
	- `pregunta`: texto de la pregunta
	- `opciones`: objeto con claves tipo `A`, `B`, `C`, ... y texto por opción
	- `respuesta_correcta`: letra que indica la opción correcta (ej. `"B"`)

- `bloques`: objeto con mapeo `{ id: nombre }` de los módulos (se usa para poblar el selector de módulos)

Ejemplo mínimo (simplificado):

```json
{
	"preguntas": [
		{"id": 1, 
        "id_bloque": 1, 
        "pregunta": "¿...",
          "opciones": {"A": "x", 
                       "B": "y"}, 
                      "respuesta_correcta": "A"}
	],
	"bloques": {"1": "Introducción"}
}
```

Si cambias o añades preguntas en `data/13bgiin.json` (por ejemplo, nuevo bloque 11 y 26 preguntas), la aplicación cargará automáticamente el nuevo contenido al recargar la página y las estadísticas/repasos se gestionarán por asignatura.

## 💾 Persistencia y claves de `localStorage`

Los datos se almacenan por asignatura usando sufijos en las claves. Claves base en `app.js` (StorageManager.KEYS):

- `viu_quiz_results` → resultados por asignatura: `viu_quiz_results_{subject}`
- `viu_quiz_stats` → estadísticas por asignatura: `viu_quiz_stats_{subject}`
- `viu_quiz_failed` → preguntas falladas por asignatura: `viu_quiz_failed_{subject}`
- `viu_quiz_penalty` → preferencia global de penalización (boolean)
- `viu_quiz_last_subject` → última asignatura usada

La preferencia de penalización (si las respuestas malas restan o no) se guarda en `viu_quiz_penalty` y se aplica al iniciar cada test.

## 📐 Sistema de puntuación

- Puntuación total escalada a 10 puntos: cada pregunta vale `10 / N` (N = número de preguntas del test).
- Si la penalización está activada, la resta por error se calcula dinámicamente como `(10/N) / (numOptions - 1)` por pregunta incorrecta (para acomodar preguntas con diferente número de opciones).

## 🧭 Cómo ejecutar localmente

Puedes abrir `index.html` directamente en el navegador o servir el directorio con un servidor estático. Recomendado (desde la raíz del proyecto):

Python 3:
```bash
python -m http.server 8000
# luego abrir http://localhost:8000
```

Node (http-server):
```bash
npm install -g http-server
http-server -c-1
# abrir http://localhost:8080
```

La app cargará los archivos JSON desde la carpeta `data/` y mostrará las preguntas correspondientes.

## 🚚 Despliegue en GitHub

El repositorio remoto del proyecto es: https://github.com/Kukegeek/viu-quiz.git

Puedes publicar en GitHub Pages o cualquier servicio estático. Tras subir (`git push`) el servicio de CI/CD o Pages desplegará la versión con las últimas preguntas.

## 📝 Añadir preguntas o bloques

1. Edita el archivo correspondiente en `data/` (por ejemplo `data/13bgiin.json`) y añade tu bloque en `bloques` y las preguntas en `preguntas`.
2. Asegúrate de que cada `id` de pregunta es único.
3. Haz commit y push al repo:
```bash
git add data/13bgiin.json
git commit -m "feat(data): add bloque 11 con 26 preguntas a 13bgiin"
git push
```
4. Recarga la aplicación en el navegador; las nuevas preguntas se cargarán automáticamente.

## ✅ Notas finales

- El nombre del modo `examen` fue renombrado a `pro` en la lógica (`APP_STATE.modeConfig`) y en la UI.
- La aplicación soporta preguntas con distinto número de opciones (2..6), baraja las opciones al iniciar un test y recalcula la clave correcta.

---

Licencia: MIT
