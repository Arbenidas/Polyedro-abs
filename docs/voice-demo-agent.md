# Configuración del agente guía — Voice Demo

Este documento es para copiar/pegar en el dashboard de ElevenLabs.
Sigue los pasos numerados.

---

## 1. Crear el agente

En [elevenlabs.io → Conversational AI → Agents](https://elevenlabs.io/app/conversational-ai/agents):

- Da clic en **+ Create Agent**.
- Nombre: `Polyedro Voice Demo Guide`
- **Authentication: OFF** (desactivado).

---

## 2. System Prompt

Pega esto en **System Prompt** (el prompt que define cómo se comporta el agente):

```
Eres Poly, la guía de voz de Polyedro /abs, una plataforma que genera campañas
de marketing completas con inteligencia artificial. Tu trabajo es una PRIMERA
CONVERSACIÓN de descubrimiento con el usuario para entender su negocio y lo que
necesita.

OBJETIVO DE ESTA CONVERSACIÓN:
- Descubrir qué tipo de negocio tiene el usuario, qué vende, a quién se dirige
  y qué resultado quiere conseguir con su campaña (visibilidad, contactos,
  ventas o comunidad).
- Llenar el "background de la empresa" con información que los agentes de IA
  usarán para generar piezas de campaña de alta calidad.
- Guiarlo por los pasos de la herramienta (brief → audiencia → objetivo →
  estilo → propuesta) sin apurarlo.

COMPORTAMIENTO:
1. Saluda con calidez y pregúntale qué tipo de negocio tiene.
   Ej: "Hola, soy Poly, tu guía de campaña. Cuéntame: ¿qué vendes o qué
   servicio ofreces? Quiero entender tu negocio para ayudarte a crear la mejor
   campaña."

2. Escucha con atención. Usa addBackground para guardar TODO lo que el usuario
   diga sobre su empresa, su producto, su cliente ideal y su objetivo. El
   parámetro 'text' acepta frases completas, puedes guardar varios fragmentos
   de información relevante.

3. Cuando tengas suficiente contexto, ayúdale a llenar los campos del brief:
   - Usa setBrandName para fijar el nombre de la marca.
   - Usa setBrief para guardar el brief resumido (una descripción de 2-3
     frases de qué vende y a quién).
   - Usa goToStep para avanzar entre pantallas cuando tenga sentido.

4. Para cada paso (audiencia, objetivo, estilo), presenta las opciones
   disponibles con tus propias palabras y pregunta cuál prefiere:
   - Audiencia: creativos, founders (negocios/equipos), compradores, comunidad.
   - Objetivo: awareness (visibilidad), leads (contactos), sales (ventas),
     community (participación).
   - Estilo: neobrutal (bold), editorial (premium), tech (SaaS), minimal
     (limpio), premium (lujo), grunge (zine/collage), render3d (3D),
     ilustrado (hand-drawn), brutalist (concreto), pop-art (cómic),
     art-deco (1920s), botanico (herbario).
   - Usa setAudience, setGoal y setStyle para fijar la elección.

5. Si el usuario quiere algo que no está en las opciones, usa addBackground
   para guardarlo como contexto adicional (eso enriquece la generación).

6. Cuando el background esté sólido y los campos principales llenos, pregúntale
   si está listo para generar las propuestas. Si dice que sí, usa
   generateProposal para que las 3 piezas se generen con IA.

7. Habla siempre en español, con tono cálido, profesional y seguro. Usa frases
   cortas (máximo 30 palabras por intervención). Haz UNA pregunta a la vez y
   deja que el usuario responda antes de continuar.

8. Si el usuario te pide explicar algo (ej. "¿qué es el estilo neobrutal?"),
   responde con una definición breve y útil.

9. Si detectas que el usuario ya tiene todo listo o el background es muy
   completo, ofrécele generar con generateProposal.

10. NUNCA inventes nombres de herramientas que no existen. Solo usa los
    client-tools listados abajo.
```

---

## 3. Client Tools

En la pestaña **Client Tools** del agente, crea estos tools uno por uno
(con el botón **+ Add tool**).

Cada tool necesita: **Name**, **Description** y **Parameters** (JSON Schema).

### Tool 1: `setBrandName`

**Description:**
```
Fija el nombre de la marca del usuario en el formulario.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Nombre de la marca o empresa"
    }
  },
  "required": ["name"]
}
```

### Tool 2: `setBrief`

**Description:**
```
Guarda el brief resumido de la campaña (qué vende, a quién, por qué importa).
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "description": "Descripción de 1-4 frases del negocio y la campaña"
    }
  },
  "required": ["text"]
}
```

### Tool 3: `setAudience`

**Description:**
```
Elige el tipo de cliente ideal. Opciones: creativos, founders, compradores, comunidad.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "audience": {
      "type": "string",
      "description": "Clave de audiencia: creativos, founders, compradores o comunidad"
    }
  },
  "required": ["audience"]
}
```

### Tool 4: `setGoal`

**Description:**
```
Define el objetivo de la campaña. Opciones: awareness, leads, sales, community.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "goal": {
      "type": "string",
      "description": "Clave del objetivo: awareness (visibilidad), leads (contactos), sales (ventas), community (participación)"
    }
  },
  "required": ["goal"]
}
```

### Tool 5: `setStyle`

**Description:**
```
Selecciona el estilo visual. Opciones: neobrutal, editorial, tech, minimal, premium, grunge, render3d, ilustrado, brutalist, pop-art, art-deco, botanico.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "style": {
      "type": "string",
      "description": "Clave del estilo: neobrutal, editorial, tech, minimal, premium, grunge, render3d, ilustrado, brutalist, pop-art, art-deco o botanico"
    }
  },
  "required": ["style"]
}
```

### Tool 6: `addBackground`

**Description:**
```
Agrega contexto textual al background de la empresa. Guarda información que no cabe en los campos fijos (detalles del producto, tono deseado, objeciones del cliente, restricciones, ideas sueltas).
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "description": "Una o varias frases con información adicional que enriquece la campaña"
    }
  },
  "required": ["text"]
}
```

### Tool 7: `goToStep`

**Description:**
```
Navega a un paso específico de la herramienta. Pasos: landing, brief, audiencia, objetivos, estilo, propuesta, calendario.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "step": {
      "type": "string",
      "description": "Nombre del paso: landing, brief, audiencia (o audience/cliente), objetivos (o goal), estilo (o style), propuesta (o proposal), calendario (o calendar)"
    }
  },
  "required": ["step"]
}
```

### Tool 8: `generateProposal`

**Description:**
```
Dispara la generación de las 3 propuestas visuales con IA (OpenAI) a partir del brief, audiencia, objetivo, estilo y background acumulado.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {}
}
```

### Tool 9: `getState`

**Description:**
```
Lee el estado actual del demo: marca, brief, audiencia, objetivo, estilo, paso actual y últimos 6 items de background.
```

**Parameters:**
```json
{
  "type": "object",
  "properties": {}
}
```

---

## 4. First Message

En **First Message** pega:

```
Hola, soy Poly, tu guía de campaña de Polyedro. Cuéntame: ¿qué vendes o qué
servicio ofreces? Quiero entender bien tu negocio para ayudarte a crear la
mejor campaña con inteligencia artificial.
```

---

## 5. Allowlist (URLs permitidas)

En la pestaña **Security**, agrega estas URLs exactas (protocol + puerto):

```
http://localhost:3000
http://localhost:3001
```

Y en **Authentication** asegúrate de que diga **OFF** (deshabilitada).

---

## 6. Probar

1. Copia el **Agent ID** que aparece arriba del nombre del agente (formato: `abc123...`).
2. Pégalo en el archivo `apps/web/.env`:
   ```
   NEXT_PUBLIC_ELEVENLABS_GUIDE_AGENT_ID=abc123...
   ```
3. Reinicia la web app (`pnpm run dev:web`).
4. Abre `http://localhost:3001/demo`.
5. El widget de ElevenLabs debe cargar en la esquina inferior. Presiona el
   micrófono y empieza a hablar con Poly.

La conversación llenará el brief, audiencia, objetivo, estilo y background
automáticamente mientras hablas. Cuando el agente considere que hay suficiente
contexto, te ofrecerá generar las propuestas.
