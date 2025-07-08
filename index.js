const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuración de vistas y archivos estáticos
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Middleware para subir archivos temporales
const upload = multer({ dest: 'uploads/' });

// Autenticación con Google Drive
const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth });

// IDs de las carpetas de Drive
const FOLDER_PENDIENTES = '19-yMSMgCXDTcTgrywcttDqyGT2_oyepf';
const FOLDER_APROBADAS = '1yRBid4wwy1hrw_Hl94OyitiztyVx8ZPw';
const FOLDER_RECHAZADAS = '13go9bbRWhdrxVsnWV_j8UnglsZePIclc';

// Página para subir fotos
app.get('/upload', (req, res) => {
    res.render('upload');
});

// Subida de fotos
app.post('/upload', upload.single('photo'), async (req, res) => {
    const fileMetadata = {
        name: req.file.originalname,
        parents: [FOLDER_PENDIENTES]
    };
    const media = {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(req.file.path)
    };
    try {
        await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
        });
        fs.unlinkSync(req.file.path);
        res.send('✅ Foto subida con éxito. Queda pendiente de aprobación.');
    } catch (err) {
        console.error(err);
        res.status(500).send('❌ Error al subir la foto.');
    }
});

// Panel de moderación
app.get('/moderar', async (req, res) => {
    try {
        const response = await drive.files.list({
            q: `'${FOLDER_PENDIENTES}' in parents and trashed = false`,
            fields: 'files(id, name, thumbnailLink)',
        });
        const fotos = response.data.files;
        res.render('moderar', { fotos });
    } catch (err) {
        console.error(err);
        res.status(500).send('❌ Error al cargar las fotos pendientes.');
    }
});

// Aprobar foto
app.get('/approve/:id', async (req, res) => {
    const fileId = req.params.id;
    try {
        await drive.files.update({
            fileId,
            addParents: FOLDER_APROBADAS,
            removeParents: FOLDER_PENDIENTES,
        });
        res.redirect('/moderar');
    } catch (err) {
        console.error(err);
        res.status(500).send('❌ Error al aprobar la foto.');
    }
});

// Rechazar foto
app.get('/reject/:id', async (req, res) => {
    const fileId = req.params.id;
    try {
        await drive.files.update({
            fileId,
            addParents: FOLDER_RECHAZADAS,
            removeParents: FOLDER_PENDIENTES,
        });
        res.redirect('/moderar');
    } catch (err) {
        console.error(err);
        res.status(500).send('❌ Error al rechazar la foto.');
    }
});

// Galería pública en loop
app.get('/galeria', async (req, res) => {
    try {
        const response = await drive.files.list({
            q: `'${FOLDER_APROBADAS}' in parents and trashed = false`,
            fields: 'files(id, name, thumbnailLink)',
        });
        const fotos = response.data.files;
        res.render('galeria', { fotos });
    } catch (err) {
        console.error(err);
        res.status(500).send('❌ Error al cargar la galería.');
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
