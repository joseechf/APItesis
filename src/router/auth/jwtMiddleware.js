import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
    jwksUri: `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, function (err, key) {
        if (err) {
            callback(err);
            return;
        }

        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
    /*client.getSigningKey(header.kid, (err, key) => {
        cb(null, key?.getPublicKey());
    });*/
}

export function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        console.log('Bearer mal creado')
        return res.status(401).json({ message: 'No autenticado' });
    }

    const token = auth.split(' ')[1];

    jwt.verify(token, getKey, { algorithms: ['ES256'], }, (err, decoded) => {
        if (err) {
            console.log('token invalido')
            return res.status(401).json({ message: 'Token inválido' });
        }

        req.auth = { userId: decoded.sub };
        next();
    });
}

export default authMiddleware
