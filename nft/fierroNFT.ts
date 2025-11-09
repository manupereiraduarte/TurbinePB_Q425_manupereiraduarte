import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
// Eliminamos la importación de 'transfer' y solo dejamos lo necesario de mpl-core
import { mplCore, create as createAsset } from '@metaplex-foundation/mpl-core'; 
import { generateSigner, keypairIdentity, createSignerFromKeypair, sol } from '@metaplex-foundation/umi';
import { existsSync, readFileSync, promises as fsPromises } from 'fs'; // Usamos fs/promises para mejor manejo asíncrono
import { publicKey } from '@metaplex-foundation/umi'; // Esta ya no es estrictamente necesaria, pero la dejamos
import pkg from '@metaplex-foundation/mpl-core';
const { updateAsset } = pkg;
// Función de ayuda para subir JSON a Pinata (sin cambios)
async function uploadJsonToPinata(jsonData: unknown, name: string): Promise<string> {
	const jwt = process.env.PINATA_JWT;
	if (!jwt) throw new Error('PINATA_JWT not set');

	// Asegúrate de que el contenido JSON tenga la estructura correcta
	if (typeof jsonData !== 'object' || jsonData === null) {
		throw new Error('Invalid JSON data structure.');
	}

	const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${jwt}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			pinataOptions: { cidVersion: 1 },
			pinataMetadata: { name },
			pinataContent: jsonData,
		})
	});

	if (!res.ok) {
		const txt = await res.text();
		throw new Error(`Pinata upload failed for ${name}: ${res.status} ${txt}`);
	}

	const out = await res.json() as { IpfsHash: string };
	const gateway = process.env.PINATA_GATEWAY_BASE ?? 'https://gateway.pinata.cloud/ipfs';
	return `${gateway}/${out.IpfsHash}`;
}

// Función de ayuda para cargar o generar una clave
async function getOrCreateIdentity(umi: ReturnType<typeof createUmi>) {
	if (existsSync('wallet.json')) {
		console.log('Using existing identity from wallet.json');
		const raw = readFileSync('wallet.json', 'utf-8');
		const secretKey: number[] = JSON.parse(raw);
		const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secretKey));
		const signer = createSignerFromKeypair(umi, keypair);
		umi.use(keypairIdentity(signer));
		return signer;
	}

	console.log('Generating new identity and saving to wallet.json');
	const signer = generateSigner(umi);
	umi.use(keypairIdentity(signer));
	// Usamos fsPromises.writeFile para un manejo asíncrono limpio en Node.js
	await fsPromises.writeFile('wallet.json', JSON.stringify(Array.from(signer.secretKey)));
	return signer;
}

// --- FUNCIÓN ADAPTADA PARA CREAR UN ÚNICO NFT ---
async function main() {
	
	// 1. Configuración de Umi
	const rpc = process.env.DEVNET_RPC ?? 'https://api.devnet.solana.com';
	const umi = createUmi(rpc).use(mplCore());

	// 2. Cargar/Crear Identidad del Mint Authority y Owner
	const signer = await getOrCreateIdentity(umi);
	// Dentro de main, justo después de obtener el signer:
	console.log('Clave pública del Owner:', signer.publicKey.toString());
	
	try {
		console.log('Airdropping 1 SOL to the signer...');
		await umi.rpc.airdrop(signer.publicKey, sol(1));
		console.log('Airdrop successful.');
	} catch (e) {
		console.log('Airdrop failed (wallet might already have SOL).');
	}

	// 3. Subir Metadatos del NFT Individual
	const metadataFilename = 'fierro_nft_metadata.json';
	console.log(`\n--- Processing ${metadataFilename} ---`);

	if (!existsSync(metadataFilename)) {
		throw new Error(`Missing ${metadataFilename}. Please create this file with your NFT metadata.`);
	}
	if (!process.env.PINATA_JWT) {
		throw new Error('Missing PINATA_JWT environment variable.');
	}

	const rawMetadata = readFileSync(metadataFilename, 'utf-8');
	const nftJson = JSON.parse(rawMetadata);
	const nftUri = await uploadJsonToPinata(nftJson, metadataFilename);
	console.log('Uploaded Metadata URI:', nftUri);

	// 4. Crear el NFT (Asset)
	const assetSigner = generateSigner(umi); // El signer/dirección del nuevo NFT

	console.log('\n--- Minting the Single NFT ---');

	// Usamos createAsset, pero omitimos la propiedad 'collection'
	const createSig = await createAsset(umi, {
		name: nftJson.name, // Tomamos el nombre del JSON
		uri: nftUri,
		asset: assetSigner,
		owner: signer.publicKey, // El owner inicial es el que firma
		authority: signer, // El signer es el Mint Authority (por defecto)
	}).sendAndConfirm(umi);

	console.log('\n------------------------------------------------');
	console.log('✅ NFT Creado y Mintado Exitosamente.');
	console.log('------------------------------------------------');
	console.log('   ID del NFT (Asset):', assetSigner.publicKey.toString());
	console.log('   Owner Inicial:', signer.publicKey.toString());
	console.log('   Signature de Creación:', createSig.signature);
	console.log('   Metadata URI:', nftUri);
	console.log('------------------------------------------------');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});