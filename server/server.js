const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const inquirer = require('inquirer');
const fs = require('fs'); // Asegurarse de que fs esté importado

const app = express();

// IMPORTANTE: Cuando pkg empaqueta, los 'assets' (como la carpeta dist) se colocan junto al ejecutable.
// `process.cwd()` obtiene el directorio de trabajo actual (donde se ejecuta el .exe).
// En un ejecutable pkg, pathToReactBuild debería ser simplemente el mismo directorio que el ejecutable.
const pathToReactBuild = path.join(process.cwd(), 'dist'); // Esto asume que 'dist' estará al mismo nivel que el .exe

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

async function startServer(port, hostname) {
    app.set('port', port);
    app.set('hostname', hostname);

    // Verificar si la carpeta 'dist' existe y es accesible
    try {
        if (!fs.existsSync(pathToReactBuild)) {
            throw new Error(`La carpeta de build de React no se encontró en: ${pathToReactBuild}`);
        }
        console.log(`Sirviendo archivos estáticos desde: ${pathToReactBuild}`);
    } catch (e) {
        console.error(`\n=================================================`);
        console.error(` ERROR CRÍTICO AL INICIAR EL SERVIDOR `);
        console.error(`=================================================`);
        console.error(`${e.message}`);
        console.error('Asegúrate de que la carpeta "dist" de tu aplicación React fue correctamente empaquetada.');
        console.error('Verifica la configuración de "assets" en el package.json para "pkg".');
        console.error(`Ruta esperada para 'dist': ${pathToReactBuild}`);
        console.error(`El directorio actual de ejecución es: ${process.cwd()}`);
        console.error(`=================================================\n`);
        process.exit(1); // Salir si la carpeta dist no se encuentra
    }
    
    app.use(express.static(pathToReactBuild));

    // Para SPA, redirigir todas las rutas al index.html
    app.get('*', (req, res) => {
        const indexPath = path.join(pathToReactBuild, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            console.error(`index.html no encontrado en ${indexPath}`);
            res.status(404).send('Error: Página no encontrada. El archivo index.html no existe en la carpeta de build.');
        }
    });

    // Manejador de errores centralizado para Express
    app.use((err, req, res, next) => {
        console.error('=================================================');
        console.error(' ERROR EN EL SERVIDOR (MANEJADOR DE ERRORES) ');
        console.error('=================================================');
        console.error(err.stack); // Mostrar el stack trace del error
        res.status(500).send('¡Algo salió mal en el servidor! Por favor, verifica los logs.');
        console.error('=================================================\n');
    });

    const serverInstance = app.listen(port, hostname, () => { // Usar 'hostname' en app.listen
        console.log(`\n=================================================`);
        console.log(` Servidor de Aplicación React Iniciado `);
        console.log(`=================================================`);
        console.log(` Accede a tu aplicación en: http://${hostname}:${port}`);
        console.log(` (Si '${hostname}' no funciona, usa la IP de tu máquina)`);
        console.log(` Sirviendo archivos desde: ${pathToReactBuild}`);
        console.log(` Presiona CTRL+C para detener el servidor.`);
        console.log(`=================================================\n`);
    });

    serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\nError: El puerto ${port} ya está en uso.`);
            console.error('Por favor, selecciona un puerto diferente o cierra la aplicación que lo está usando.');
        } else {
            console.error(`\nError al iniciar el servidor: ${err.message}`);
        }
        process.exit(1);
    });
}

async function main() {
    console.log("================================================");
    console.log("  Bienvenido al Servidor de Inventario CIEC   ");
    console.log("================================================");

    const initialQuestion = await inquirer.prompt({
        type: 'confirm',
        name: 'start',
        message: '¿Deseas iniciar el servidor ahora?',
        default: true
    });

    if (!initialQuestion.start) {
        console.log('Servidor no iniciado. ¡Hasta luego!');
        process.exit(0);
    }

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'hostname',
            message: 'Ingresa el nombre de host deseado para acceder a la aplicación (ej. www.requisoftware.com, mi-inventario.local):',
            default: 'localhost'
        },
        {
            type: 'input',
            name: 'port',
            message: 'Ingresa el puerto en el que el servidor escuchará (ej. 80, 8080, 3000):',
            default: '3000',
            validate: (value) => {
                const parsedPort = parseInt(value, 10);
                if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
                    return 'Por favor, ingresa un número de puerto válido (1-65535).';
                }
                return true;
            }
        }
    ]);

    const port = parseInt(answers.port, 10);
    const hostname = answers.hostname.toLowerCase();

    await startServer(port, hostname);
}

main().catch(console.error); // Captura errores no manejados en la función main