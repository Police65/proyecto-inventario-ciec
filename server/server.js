const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const bonjour = require('bonjour')(); // Importar e inicializar bonjour

// Importación de inquirer. Se mantiene el bloque try-catch por robustez.
let inquirer;
try {
    inquirer = require('inquirer');
} catch (e) {
    console.error("Error al cargar el módulo 'inquirer'. Asegúrate de que esté instalado correctamente.");
    console.error(e.message);
    process.exit(1);
}

const app = express();

const pathToReactBuild = path.join(__dirname, 'dist'); // Ruta a 'dist' dentro del ejecutable

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

async function startServer(port, hostname, mdnsServiceName) {
    app.set('port', port);
    app.set('hostname', hostname); // Este 'hostname' es para el enlace del servidor (0.0.0.0, localhost, etc.)

    // Reincorporar y mejorar la verificación de existencia de la carpeta 'dist'
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
        console.error('Asegúrate de que la carpeta "dist" de tu aplicación React fue copiada correctamente al directorio del servidor.');
        console.error('Verifica la configuración de "assets" en el package.json para "pkg" y la ruta de acceso en server.js.');
        console.error(`Ruta esperada para 'dist': ${pathToReactBuild}`);
        console.error(`El directorio actual de ejecución es: ${process.cwd()}`);
        console.error(`Ruta del ejecutable: ${process.execPath}`);
        console.error(`=================================================\n`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5 segundos para que el usuario lea el error
        process.exit(1); // Salir si la carpeta dist no se encuentra
    }
    
    app.use(express.static(pathToReactBuild));

    // Para Single Page Applications (SPA), redirigir todas las rutas al index.html
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

    // Usar el 'hostname' para el enlace del servidor (0.0.0.0 para ser accesible en red local)
    const serverInstance = app.listen(port, hostname, () => {
        console.log(`\n=================================================`);
        console.log(` Servidor de Aplicación React Iniciado `);
        console.log(`=================================================`);
        console.log(` Servidor web escuchando en: http://${hostname}:${port}`);
        console.log(` Sirviendo archivos desde: ${pathToReactBuild}`);
        console.log(` Presiona CTRL+C para detener el servidor.`);
        console.log(`=================================================\n`);

        // Publicar el servicio mDNS (Bonjour)
        try {
            bonjour.publish({ name: mdnsServiceName, type: 'http', port: port, protocol: 'tcp' });
            console.log(` Servicio mDNS (Bonjour) publicado como: http://${mdnsServiceName}.local:${port}`);
            console.log(` (Puedes acceder desde otros dispositivos en la red local usando este nombre)`);
            console.log(`=================================================\n`);
        } catch (bonjourError) {
            console.error(`\nError al publicar el servicio mDNS (Bonjour): ${bonjourError.message}`);
            console.error(`Asegúrate de que no hay otro servicio con el mismo nombre y puerto en la red.`);
            console.error(`Continuando sin mDNS.`);
            console.error(`=================================================\n`);
        }
    });

    serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\nError: El puerto ${port} ya está en uso.`);
            console.error('Por favor, selecciona un puerto diferente o cierra la aplicación que lo está usando.');
        } else if (err.code === 'EADDRNOTAVAIL') {
            console.error(`\nError: La dirección IP o nombre de host '${hostname}' no está disponible en esta máquina.`);
            console.error('Intenta con "0.0.0.0" para escuchar en todas las interfaces, o "localhost".');
        } else if (err.code === 'EACCES' && port < 1024) {
            console.error(`\nError: Permiso denegado para el puerto ${port}. Los puertos por debajo de 1024 requieren permisos de administrador.`);
            console.error('Intenta con un puerto mayor (ej. 3000, 8080) o ejecuta el ejecutable como administrador.');
        }
        else {
            console.error(`\nError al iniciar el servidor: ${err.message}`);
        }
        // Asegúrate de detener el servicio bonjour si hubo un error al iniciar el servidor
        bonjour.unpublishAll(() => {
            console.log('Servicio mDNS detenido.');
            setTimeout(() => process.exit(1), 5000); // Espera 5 segundos antes de salir
        });
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
        bonjour.unpublishAll(() => {
            console.log('Servicio mDNS detenido.');
            setTimeout(() => process.exit(0), 3000); // Espera 3 segundos
        });
        return; // Salir de la función main
    }

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'serverBindingAddress',
            message: 'Ingresa la dirección IP o nombre de host para que el servidor escuche (ej. 0.0.0.0 para todas las interfaces, localhost):',
            default: '0.0.0.0' // CAMBIO CLAVE: Default a 0.0.0.0 para accesibilidad de red
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
        },
        {
            type: 'input',
            name: 'mdnsServiceName',
            message: 'Ingresa el nombre del servicio mDNS (ej. requisoftware). Podrás accederlo como <nombre>.local:',
            default: 'inventario-ciec' // Nuevo campo para el nombre mDNS
        }
    ]);

    const port = parseInt(answers.port, 10);
    const serverBindingAddress = answers.serverBindingAddress.toLowerCase();
    const mdnsServiceName = answers.mdnsServiceName.toLowerCase();

    await startServer(port, serverBindingAddress, mdnsServiceName);
}

main().catch(async (e) => {
    console.error('=================================================');
    console.error(' ERROR NO MANEJADO EN LA FUNCIÓN PRINCIPAL ');
    console.error('=================================================');
    console.error(e.stack || e.message);
    console.error('El servidor se cerrará. Por favor, revisa el error anterior.');
    console.error('=================================================\n');
    bonjour.unpublishAll(() => {
        console.log('Servicio mDNS detenido debido a un error.');
        setTimeout(() => process.exit(1), 5000); // Espera 5 segundos
    });
});

// Asegurarse de que los servicios bonjour se detengan al cerrar el proceso
process.on('SIGINT', () => {
    console.log('\nDetectado CTRL+C. Deteniendo el servidor...');
    bonjour.unpublishAll(() => {
        console.log('Servicio mDNS detenido. Saliendo...');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\nDetectado SIGTERM. Deteniendo el servidor...');
    bonjour.unpublishAll(() => {
        console.log('Servicio mDNS detenido. Saliendo...');
        process.exit(0);
    });
});