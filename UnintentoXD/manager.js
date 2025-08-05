const { exec } = require('child_process');
const readline = require('readline');
const os = require('os');

// Función para obtener la dirección IP local
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'IP no encontrada';
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let projectsInSession = [];
let initialPm2Apps = [];
let initialExistingNames = new Set();
let initialNextPort = 3000;

// Función para obtener el estado actual de PM2 y el siguiente puerto disponible
async function getPm2StatusAndPort() {
    return new Promise((resolve) => {
        exec('npx pm2 list --json', (error, stdout) => {
            let highestPort = 2999;
            if (!error && stdout) {
                try {
                    const apps = JSON.parse(stdout);
                    initialPm2Apps = apps;
                    apps.forEach(app => {
                        if (app.pm2_env.env && app.pm2_env.env.PORT) {
                            const port = parseInt(app.pm2_env.env.PORT);
                            if (!isNaN(port) && port > highestPort) {
                                highestPort = port;
                            }
                        }
                        initialExistingNames.add(app.name);
                    });
                } catch (e) {
                    console.error('Error al analizar la salida de PM2. Empezando de cero.');
                }
            }
            initialNextPort = (highestPort >= 3000) ? highestPort + 1 : 3000;
            resolve();
        });
    });
}

// Función principal para la pregunta interactiva, ahora con el puerto como parámetro
function askForProject(currentPort) {
    if (projectsInSession.length === 0) {
        console.log('-------------------------------------------------');
        if (initialPm2Apps.length > 0) {
            console.log('Proyectos existentes en PM2:');
            initialPm2Apps.forEach(app => {
                const port = app.pm2_env.env ? app.pm2_env.env.PORT : 'N/A';
                console.log(`- '${app.name}' (ID: ${app.pm_id}) en el puerto ${port}, estado: ${app.pm2_env.status}`);
            });
        } else {
            console.log('No se encontraron proyectos activos en PM2.');
        }
        console.log('-------------------------------------------------');
        console.log(`Siguiente puerto disponible para un nuevo proyecto: ${currentPort}`);
    }

    rl.question('¿Desea añadir/iniciar otro proyecto? (s/n) ', (answer) => {
        if (answer.toLowerCase() === 's') {
            rl.question('¿Cuál es el nombre de la carpeta del proyecto? ', (folderName) => {
                const projectName = `proyecto-${folderName}`;
                const basePath = `./${folderName}`;
                let command;

                if (initialExistingNames.has(projectName)) {
                    console.log(`\nEl proyecto '${projectName}' ya existe. Reiniciando...`);
                    const existingApp = initialPm2Apps.find(app => app.name === projectName);
                    const assignedPort = existingApp && existingApp.pm2_env.env.PORT ? existingApp.pm2_env.env.PORT : currentPort;
                    command = `npx pm2 restart "${projectName}" --update-env --env BASE_PATH=${basePath} --env PORT=${assignedPort}`;
                    projectsInSession.push({ name: projectName, folder: folderName, port: assignedPort });
                } else {
                    console.log(`\nIniciando nuevo proyecto '${projectName}'...`);
                    command = `npx pm2 start server.js --name "${projectName}" -- start --port ${currentPort} --env BASE_PATH=${basePath}`;
                    projectsInSession.push({ name: projectName, folder: folderName, port: currentPort });
                }

                console.log(`Ejecutando: ${command}`);

                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error al iniciar/reiniciar el proyecto: ${error.message}`);
                    }
                    if (stderr) {
                        console.error(`stderr: ${stderr}`);
                    }
                    console.log(`stdout: ${stdout}`);
                    const finalPort = command.includes('--env PORT=') ? command.split('--env PORT=')[1].split(' ')[0] : 'N/A';
                    console.log(`\nProyecto '${projectName}' procesado en el puerto ${finalPort}.`);

                    // Se pasa el puerto incrementado a la siguiente llamada recursiva
                    askForProject(currentPort + 1);
                });
            });
        } else {
            console.log('\n=================================================');
            console.log('    ✅ Todos los proyectos han sido procesados.    ');
            console.log('=================================================\n');

            exec('npx pm2 list --json', (err, stdout) => {
                if (err || !stdout) {
                    console.log('No se encontraron proyectos activos.');
                    rl.close();
                    return;
                }

                try {
                    const finalApps = JSON.parse(stdout);
                    if (finalApps.length > 0) {
                        const localIp = getLocalIpAddress();
                        console.log('Estado final de los proyectos:');
                        finalApps.forEach(p => {
                            const port = p.pm2_env.env ? p.pm2_env.env.PORT : 'N/A';
                            const folder = p.pm2_env.env ? p.pm2_env.env.BASE_PATH.replace('./', '') : 'N/A';
                            if (p.pm2_env.status === 'online') {
                                console.log(`- '${p.name}' sirviendo la carpeta '${folder}' en el puerto ${port}:`);
                                console.log(`  - Local: http://localhost:${port}`);
                                console.log(`  - Red:   http://${localIp}:${port}`);
                            }
                        });
                    } else {
                        console.log('No se inició ningún proyecto.');
                    }
                    console.log('\n-------------------------------------------------');
                    console.log('Comandos de gestión con NPM (usa estos comandos):');
                    console.log('-------------------------------------------------');
                    console.log('npx pm2 list                                      // Ver el estado de todos los proyectos');
                    console.log('npx pm2 stop <nombre_del_proyecto>                // Detener un proyecto específico');
                    console.log('npx pm2 restart <nombre_del_proyecto>           // Reiniciar un proyecto específico');
                    console.log('npx pm2 stop all                                // Detener todos los proyectos');
                    console.log('npx pm2 restart all                             // Reiniciar todos los proyectos');
                    console.log('-------------------------------------------------');
                    rl.close();
                } catch (e) {
                    console.error('Error al procesar la lista final de proyectos.');
                    rl.close();
                }
            });
        }
    });
}

// Iniciar el proceso
(async () => {
    await getPm2StatusAndPort();
    askForProject(initialNextPort);
})();