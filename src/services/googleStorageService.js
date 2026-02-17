import { Storage } from '@google-cloud/storage';
import { nanoid } from 'nanoid';
import path from 'path';

class GoogleStorageService {
    constructor() {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        console.log('iD:', credentials.project_id);
        this.storage = new Storage({
            projectId: credentials.project_id,
            credentials: credentials,
        });

        this.bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || '';
    }

    /**
     * Subir imagen de referencia a Google Cloud Storage
     * @param {Buffer} fileBuffer - Buffer del archivo
     * @param {String} originalName - Nombre original del archivo
     * @param {String} userId - ID del usuario
     * @returns {Promise<String>} - URL pública de la imagen
     */
    async uploadReferenceImage(fileBuffer, originalName, userId) {
        try {
            const fileExtension = path.extname(originalName);
            const fileName = `references/${userId}/${nanoid(10)}${fileExtension}`;

            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(fileName);

            // Subir el archivo
            await file.save(fileBuffer, {
                metadata: {
                    contentType: this.getContentType(fileExtension),
                    metadata: {
                        uploadedBy: userId,
                        uploadedAt: new Date().toISOString(),
                    },
                },
                public: true, // Hacer el archivo público
            });

            // Obtener URL pública
            const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

            console.log(`✅ Image uploaded: ${publicUrl}`);
            return publicUrl;
        } catch (error) {
            console.error('Error uploading image to Google Cloud Storage:', error);
            throw new Error('Error al subir la imagen');
        }
    }

    /**
     * Eliminar imagen de Google Cloud Storage
     * @param {String} fileUrl - URL del archivo a eliminar
     */
    async deleteImage(fileUrl) {
        try {
            // Extraer el path del archivo de la URL
            const urlParts = fileUrl.split(`${this.bucketName}/`);
            if (urlParts.length < 2) {
                throw new Error('URL de archivo inválida');
            }

            const filePath = urlParts[1];
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(filePath);

            await file.delete();
            console.log(`✅ Image deleted: ${filePath}`);
        } catch (error) {
            console.error('Error deleting image from Google Cloud Storage:', error);
            // No lanzar error, solo registrar
        }
    }

    /**
     * Verificar si el bucket existe y es accesible
     */
    async verifyBucket() {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const [exists] = await bucket.exists();

            if (!exists) {
                console.error(`❌ Bucket ${this.bucketName} does not exist`);
                return false;
            }

            console.log(`✅ Bucket ${this.bucketName} is accessible`);
            return true;
        } catch (error) {
            console.error('Error verifying bucket:', error);
            return false;
        }
    }

    /**
     * Obtener tipo de contenido según extensión
     */
    getContentType(extension) {
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
        };

        return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
    }

    /**
     * Validar tipo de archivo
     */
    isValidImageType(mimetype) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        return allowedTypes.includes(mimetype);
    }

    /**
     * Validar tamaño de archivo (máximo 5MB)
     */
    isValidFileSize(size) {
        const maxSize = 15 * 1024 * 1024; // 5MB
        return size <= maxSize;
    }
}

export default new GoogleStorageService();