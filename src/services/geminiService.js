import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }

    /**
     * Generar HTML/CSS a partir de una imagen de referencia
     * @param {String} imageUrl - URL de la imagen de referencia
     * @param {Object} pageData - Datos de la página (título, nombre, etc.)
     * @returns {Promise<Object>} - { html, css }
     */
    async generatePageFromImage(imageUrl, pageData) {
        try {
            const prompt = this.buildPrompt(pageData);

            // Descargar la imagen
            const response = await fetch(imageUrl);
            const imageBuffer = await response.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString('base64');

            // Determinar el mimeType según la URL
            let mimeType = 'image/jpeg';
            if (imageUrl.includes('.png')) mimeType = 'image/png';
            else if (imageUrl.includes('.gif')) mimeType = 'image/gif';
            else if (imageUrl.includes('.webp')) mimeType = 'image/webp';

            // Preparar la imagen para Gemini
            const imagePart = {
                inlineData: {
                    data: base64Image,
                    mimeType,
                },
            };

            // Generar contenido
            console.log('🤖 Generando contenido con Gemini...');
            const result = await this.model.generateContent([prompt, imagePart]);
            const text = result.response.text();

            // Log de la respuesta para debugging
            console.log('📝 Respuesta de Gemini (primeros 500 chars):', text.substring(0, 500));
            console.log('📏 Longitud total de respuesta:', text.length);

            // Extraer HTML y CSS del resultado
            const { html, css } = this.extractHTMLAndCSS(text);

            console.log('✅ HTML extraído, longitud:', html.length);
            console.log('✅ CSS extraído, longitud:', css.length);

            return { html, css };
        } catch (error) {
            console.error('❌ Error generating page with Gemini:', error);
            throw new Error('Error al generar la página con IA');
        }
    }

    /**
     * Construir el prompt para Gemini
     * Genera FRAGMENTOS HTML (no documentos completos) para ser inyectados en un div
     */
    buildPrompt(pageData) {
        const { title, recipientName, message, yesButtonText, noButtonText } = pageData;

        return `Eres un diseñador web experto especializado en páginas románticas y emotivas. Analiza la imagen de referencia con mucho detalle y crea HTML + CSS que REPLIQUE fielmente su estilo visual.

ANALIZA DE LA IMAGEN:
- Los colores exactos del fondo (gradientes, tonos, saturación)
- Las decoraciones visuales (corazones, estrellas, brillos, patrones)
- La textura y atmósfera general
- Si hay una tarjeta/card, su estilo (bordes, sombras, forma)
- La paleta de colores completa

CONTENIDO EXACTO A USAR (NO CAMBIAR NI DUPLICAR):
- Título: "${title}"
- Destinatario: "${recipientName}"
${message ? `- Mensaje: "${message}"` : '- No hay mensaje adicional'}
- Texto botón positivo: "${yesButtonText || 'Sí'}"
- Texto botón negativo: "${noButtonText || 'No'}"

⚠️ REGLAS CRÍTICAS:
1. Genera un FRAGMENTO HTML, NO un documento completo (PROHIBIDO: <!DOCTYPE>, <html>, <head>, <body>)
2. El HTML se inyectará dentro de un <div> existente en la página
3. PROHIBIDO JavaScript, onclick, onload o cualquier evento inline
4. PROHIBIDO <script>, <iframe>, <embed>, <object>
5. Cada elemento de contenido debe aparecer UNA SOLA VEZ (no duplicar título, nombre, botones, etc.)
6. Los botones DEBEN tener id="yes-button" y id="no-button"
7. Usa CSS puro para TODAS las animaciones y decoraciones

GENERA EXACTAMENTE ESTOS DOS BLOQUES:

\`\`\`html
<div class="page-wrapper">
    <!-- Usa múltiples divs para crear decoraciones con CSS -->
    <div class="deco deco-1"></div>
    <div class="deco deco-2"></div>
    <div class="deco deco-3"></div>
    <div class="deco deco-4"></div>
    <div class="deco deco-5"></div>
    <div class="deco deco-6"></div>

    <div class="card">
        <h1>${title}</h1>
        <p class="recipient">${recipientName}</p>
        ${message ? `<p class="message">${message}</p>` : ''}
        <div class="buttons">
            <button id="yes-button">${yesButtonText || 'Sí'}</button>
            <button id="no-button">${noButtonText || 'No'}</button>
        </div>
    </div>
</div>
\`\`\`

\`\`\`css
/* ===== ESTILOS QUE REPLICAN LA IMAGEN DE REFERENCIA ===== */

.page-wrapper {
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    /* AQUÍ: Replica el fondo de la imagen con gradientes, colores exactos */
    /* Ejemplo: background: linear-gradient(135deg, #8b0000 0%, #dc143c 50%, #8b0000 100%); */
}

/* AQUÍ: Usa los .deco para crear decoraciones que imiten la imagen */
/* Usa border-radius: 50% para círculos, transforms para rotarlos, etc. */
/* Usa ::before y ::after en cada .deco para multiplicar las decoraciones */
.deco {
    position: absolute;
    pointer-events: none;
}

/* Crea corazones, círculos, brillos u otras formas que veas en la imagen */
.deco-1 { /* posición y forma */ }
.deco-2 { /* posición y forma */ }
.deco-3 { /* posición y forma */ }
.deco-4 { /* posición y forma */ }
.deco-5 { /* posición y forma */ }
.deco-6 { /* posición y forma */ }

/* Si la imagen tiene una tarjeta blanca/clara, replica su estilo */
.card {
    position: relative;
    z-index: 10;
    max-width: 500px;
    width: 90%;
    padding: 3rem 2rem;
    text-align: center;
    /* background, border-radius, box-shadow según la imagen */
}

h1 {
    /* Tipografía y color según la imagen */
    margin-bottom: 1rem;
}

.recipient {
    /* Estilo del nombre */
    margin-bottom: 1rem;
}

.message {
    /* Estilo del mensaje */
    margin-bottom: 2rem;
}

.buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
}

#yes-button {
    padding: 0.8rem 2rem;
    font-size: 1.1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    /* Color según la imagen */
}

#yes-button:hover {
    transform: scale(1.05);
}

#no-button {
    padding: 0.8rem 2rem;
    font-size: 1.1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    /* Color según la imagen */
}

#no-button:hover {
    transform: scale(1.05);
}

/* Animaciones opcionales para decoraciones */
@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-15px); }
}

@keyframes pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
}

/* Responsive */
@media (max-width: 768px) {
    .card {
        padding: 2rem 1.5rem;
    }
    h1 {
        font-size: 1.8rem;
    }
    .recipient {
        font-size: 1.3rem;
    }
}
\`\`\`

RECUERDA: 
- Replica FIELMENTE los colores y el estilo de la imagen
- NO uses colores genéricos, usa los EXACTOS de la imagen
- Si la imagen tiene corazones, crea corazones con CSS (usando border-radius y transforms)
- Si tiene brillos, usa box-shadow o pseudo-elementos
- Responde SOLO con los dos bloques de código, nada más antes ni después`;
    }

    /**
     * Extraer HTML y CSS del texto generado - Versión robusta para fragmentos
     */
    extractHTMLAndCSS(text) {
        let html = '';
        let css = '';

        // Método 1: Buscar bloques con ```html y ```css
        const htmlMatch = text.match(/```html\s*\n([\s\S]*?)```/i);
        const cssMatch = text.match(/```css\s*\n([\s\S]*?)```/i);

        if (htmlMatch) {
            html = htmlMatch[1].trim();
            console.log('✅ HTML encontrado con método 1');
        }
        if (cssMatch) {
            css = cssMatch[1].trim();
            console.log('✅ CSS encontrado con método 1');
        }

        // Método 2: Si no funcionó, buscar bloques genéricos ```
        if (!html || !css) {
            console.log('⚠️ Método 1 falló parcialmente, intentando método 2...');
            const codeBlocks = text.match(/```[\s\S]*?```/g);

            if (codeBlocks && codeBlocks.length >= 2) {
                if (!html) {
                    html = codeBlocks[0]
                        .replace(/```html\s*\n|```\s*\n|```/gi, '')
                        .trim();
                    console.log('✅ HTML extraído con método 2');
                }

                if (!css) {
                    css = codeBlocks[1]
                        .replace(/```css\s*\n|```\s*\n|```/gi, '')
                        .trim();
                    console.log('✅ CSS extraído con método 2');
                }
            }
        }

        // Método 3: Buscar por patrones conocidos en el contenido
        if (!html) {
            console.log('⚠️ Método 2 falló para HTML, intentando método 3...');

            // Buscar fragmento que contenga page-wrapper
            const fragmentMatch = text.match(/(<div class="page-wrapper">[\s\S]*?<\/div>\s*<\/div>)/i);
            if (fragmentMatch) {
                html = fragmentMatch[1].trim();
                console.log('✅ HTML encontrado con método 3 (fragmento)');
            }

            // Si no hay fragmento, buscar documento completo y extraer el body
            if (!html) {
                const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                if (bodyMatch) {
                    html = bodyMatch[1].trim();
                    console.log('✅ HTML extraído del body con método 3');
                }
            }
        }

        if (!css) {
            console.log('⚠️ Método 2 falló para CSS, intentando método 3...');

            // Buscar bloque CSS por contenido
            const cssContentMatch = text.match(/(\.page-wrapper\s*\{[\s\S]*)/i);
            if (cssContentMatch) {
                css = cssContentMatch[1].trim();
                // Limpiar posibles backticks al final
                css = css.replace(/```\s*$/g, '').trim();
                console.log('✅ CSS encontrado con método 3');
            }

            // Intentar con selector universal
            if (!css) {
                const cssUniversalMatch = text.match(/(\*\s*\{[\s\S]*)/i);
                if (cssUniversalMatch) {
                    css = cssUniversalMatch[1].trim();
                    css = css.replace(/```\s*$/g, '').trim();
                    console.log('✅ CSS encontrado con método 3 (selector universal)');
                }
            }
        }

        // Método 4: Si Gemini generó un documento completo a pesar del prompt, extraer lo necesario
        if (html && html.includes('<!DOCTYPE')) {
            console.log('⚠️ Gemini generó documento completo, extrayendo body...');
            const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            if (bodyMatch) {
                html = bodyMatch[1].trim();
                console.log('✅ Body extraído del documento completo');
            }

            // También extraer CSS del <style> si existe dentro del HTML
            const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
            if (styleMatch && !css) {
                css = styleMatch[1].trim();
                console.log('✅ CSS extraído del <style> del documento');
            }

            // Limpiar etiquetas <style> del HTML
            html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
        }

        // Validar resultados
        if (!html) {
            console.error('❌ No se pudo extraer HTML. Respuesta completa:', text);
            throw new Error('No se pudo extraer el HTML del código generado. Intenta de nuevo o usa una imagen diferente.');
        }

        if (!css) {
            console.error('❌ No se pudo extraer CSS. Usando fallback...');
            console.log('📄 HTML extraído:', html.substring(0, 200));
            css = this.generateFallbackCSS();
            console.log('✅ CSS básico generado como fallback');
        }

        // Asegurar que el HTML tenga la estructura page-wrapper
        if (!html.includes('page-wrapper')) {
            console.warn('⚠️ HTML no tiene page-wrapper, envolviéndolo...');
            html = `<div class="page-wrapper">${html}</div>`;
        }

        console.log('✅ Extracción completa exitosa');
        console.log('📊 HTML final:', html.length, 'caracteres');
        console.log('📊 CSS final:', css.length, 'caracteres');

        return { html, css };
    }

    /**
     * Generar CSS básico como fallback
     */
    generateFallbackCSS() {
        return `
.page-wrapper {
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #8b0000 0%, #dc143c 40%, #ff6b81 70%, #8b0000 100%);
    font-family: 'Georgia', 'Times New Roman', serif;
}

.deco {
    position: absolute;
    pointer-events: none;
}

.deco-1 {
    width: 80px;
    height: 80px;
    top: 10%;
    left: 10%;
    background: radial-gradient(circle, rgba(255,105,135,0.6) 0%, transparent 70%);
    border-radius: 50%;
    animation: float 4s ease-in-out infinite;
}

.deco-2 {
    width: 60px;
    height: 60px;
    top: 20%;
    right: 15%;
    background: radial-gradient(circle, rgba(255,182,193,0.5) 0%, transparent 70%);
    border-radius: 50%;
    animation: float 5s ease-in-out infinite 1s;
}

.deco-3 {
    width: 100px;
    height: 100px;
    bottom: 15%;
    left: 20%;
    background: radial-gradient(circle, rgba(255,105,135,0.4) 0%, transparent 70%);
    border-radius: 50%;
    animation: float 6s ease-in-out infinite 0.5s;
}

.deco-4 {
    width: 50px;
    height: 50px;
    bottom: 25%;
    right: 10%;
    background: radial-gradient(circle, rgba(255,192,203,0.5) 0%, transparent 70%);
    border-radius: 50%;
    animation: float 4.5s ease-in-out infinite 2s;
}

.deco-5 {
    width: 40px;
    height: 40px;
    top: 50%;
    left: 5%;
    background: radial-gradient(circle, rgba(255,105,135,0.3) 0%, transparent 70%);
    border-radius: 50%;
    animation: pulse 3s ease-in-out infinite;
}

.deco-6 {
    width: 70px;
    height: 70px;
    top: 5%;
    right: 30%;
    background: radial-gradient(circle, rgba(255,182,193,0.4) 0%, transparent 70%);
    border-radius: 50%;
    animation: pulse 4s ease-in-out infinite 1.5s;
}

.card {
    position: relative;
    z-index: 10;
    max-width: 500px;
    width: 90%;
    padding: 3rem 2rem;
    text-align: center;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

h1 {
    font-size: 2.2rem;
    margin-bottom: 1rem;
    color: #c0392b;
    line-height: 1.3;
}

.recipient {
    font-size: 1.6rem;
    margin-bottom: 1rem;
    font-weight: 600;
    color: #333;
}

.message {
    font-size: 1.1rem;
    margin-bottom: 2rem;
    color: #555;
    line-height: 1.6;
}

.buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
}

#yes-button {
    padding: 0.8rem 2.5rem;
    font-size: 1.1rem;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: bold;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4);
}

#yes-button:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(231, 76, 60, 0.6);
}

#no-button {
    padding: 0.8rem 2.5rem;
    font-size: 1.1rem;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: bold;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    background: #666;
    color: white;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

#no-button:hover {
    transform: scale(1.05);
}

@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-15px); }
}

@keyframes pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
}

@media (max-width: 768px) {
    .card {
        padding: 2rem 1.5rem;
    }
    h1 {
        font-size: 1.8rem;
    }
    .recipient {
        font-size: 1.3rem;
    }
    .buttons {
        flex-direction: column;
    }
    #yes-button, #no-button {
        width: 100%;
    }
}
        `.trim();
    }

    /**
     * Validar que el HTML y CSS generados sean seguros y correctos
     */
    validateGeneratedCode(html, css) {
        console.log('🔍 Validando código generado...');

        // 1. Verificar que no contenga scripts maliciosos o atributos de eventos
        const dangerousPatterns = [
            {
                pattern: /<script[^>]*>[\s\S]*?<\/script>/gi,
                message: 'No se permiten etiquetas <script>',
            },
            {
                pattern: /\son\w+\s*=/gi,
                message: 'No se permiten atributos de eventos (onclick, onload, etc.)',
            },
            {
                pattern: /javascript:/gi,
                message: 'No se permite javascript: en URLs',
            },
            {
                pattern: /<iframe[^>]*>/gi,
                message: 'No se permiten iframes',
            },
            {
                pattern: /<embed[^>]*>/gi,
                message: 'No se permiten etiquetas embed',
            },
            {
                pattern: /<object[^>]*>/gi,
                message: 'No se permiten etiquetas object',
            },
        ];

        for (const { pattern, message } of dangerousPatterns) {
            if (pattern.test(html)) {
                throw new Error(`Código HTML no válido: ${message}`);
            }
            if (pattern.test(css)) {
                throw new Error(`Código CSS no válido: ${message}`);
            }
        }

        // 2. Verificar que el HTML tenga los botones requeridos
        if (!html.includes('id="yes-button"')) {
            console.warn('⚠️ Advertencia: No se encontró id="yes-button"');
        }
        if (!html.includes('id="no-button"')) {
            console.warn('⚠️ Advertencia: No se encontró id="no-button"');
        }

        // 3. Verificar que no haya contenido duplicado sospechoso
        const buttonYesMatches = (html.match(/id="yes-button"/gi) || []).length;
        const buttonNoMatches = (html.match(/id="no-button"/gi) || []).length;

        if (buttonYesMatches > 1 || buttonNoMatches > 1) {
            throw new Error(
                'Los botones están duplicados. Solo debe haber un botón "yes-button" y un botón "no-button".',
            );
        }

        // 4. Verificar tamaño razonable
        if (html.length > 50000) {
            throw new Error('El HTML generado es demasiado largo. Podría contener contenido duplicado.');
        }
        if (css.length > 50000) {
            throw new Error('El CSS generado es demasiado largo. Podría contener contenido duplicado.');
        }

        // 5. Verificar que NO sea un documento completo (debe ser fragmento)
        if (html.includes('<!DOCTYPE') || html.includes('<html')) {
            console.warn('⚠️ El HTML contiene estructura de documento completo, debería ser un fragmento');
        }

        console.log('✅ Validación completada exitosamente');
        return true;
    }
}

export default new GeminiService();