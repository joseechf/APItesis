import jwt from 'jsonwebtoken'
import JwksClient from 'jwks-rsa'

const client = JwksClient({
    jwksUri: `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`
})

function getKey(header, callback) {
    client.getSigningKey(header.kid,function (err, key){
        if(err){
            callback(err)
            return
        }
        const signingKey = key.getPublicKey()
        callback(null,signingKey)
    })
}

export function authMiddleware(req, res, next){
    const auth = req.headers.authorization
    if(!auth?.startsWith('Bearer ')){
        return res.status(401).json({message: 'No autenticado'})
    }
    const token = auth.split(' ')[1]

    jwt.verify(token,getKey,{algorithms: ['ES256','RS256','HS256']}, (err,decoded) => {
        if(err){
            return res.status(401).json({message: 'Token invalido'})
        }
        req.auth = {userId: decoded.sub, email: decoded.email}
        next()
    })
}

export default authMiddleware