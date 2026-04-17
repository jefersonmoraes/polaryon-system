const str = 'Melhor valor (unitário) R$ 5,0000\nMeu valor (unitário) R$ 50,0000';
const melhorMatch = str.match(/Melhor valor[^\d,]+([\d,.]+)/i);
const meuMatch = str.match(/Meu valor[^\d,]+([\d,.]+)/i);
console.log('Melhor arr:', melhorMatch);
console.log('Meu arr:', meuMatch);
