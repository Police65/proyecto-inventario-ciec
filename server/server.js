const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const inquirer = require('inquirer');
const fs = require('fs');

const app = express();

const pathToReactBuild = path.join(path.dirname(process.execPath), 'dist');

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

async function startServer(port, hostname) {
    app.set('port', port);
    app.set('hostname', hostname);

    try {

    } catch (e) {
        console.error(`Error al acceder a la carpeta de build de React en ${pathToReactBuild}`);
        console.error('Asegúrate de que la carpeta "dist" fue correctamente empaquetada con pkg.');
        process.exit(1);
    }
    
    app.use(express.static(pathToReactBuild));

    app.get('*', (req, res) => {
        res.sendFile(path.join(pathToReactBuild, 'index.html'));
    });


    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).send('¡Algo salió mal en el servidor!');
    });

    app.listen(port, () => {
        console.log(`\n=================================================`);
        console.log(` Servidor de Aplicación React Iniciado `);
        console.log(`=================================================`);
        console.log(` Accede a tu aplicación en: http://${hostname}:${port}`);
        console.log(` (Si '${hostname}' no funciona, usa la IP de tu máquina)`);
        console.log(` Sirviendo archivos desde: ${pathToReactBuild}`);
        console.log(` Presiona CTRL+C para detener el servidor.`);
        console.log(`=================================================\n`);
    }).on('error', (err) => {
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

main().catch(console.error);