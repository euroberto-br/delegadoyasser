# Bibliotecas de terceiros

Arquivos servidos pelo próprio domínio, sem CDN externo. Só são baixados
quando alguém usa a seção **Foto com o Yasser** — o carregamento é feito sob
demanda por `js/foto-com-yasser.js`, então quem apenas passa pela seção não
paga por eles.

## TensorFlow.js 4.22.0 — `tfjs/`

Licença Apache 2.0 · https://github.com/tensorflow/tfjs

| Arquivo | Tamanho | Para quê |
| --- | --- | --- |
| `tf-core.min.js` | 287 KB | núcleo (tensores, backend) |
| `tf-converter.min.js` | 315 KB | carrega o modelo em formato graph-model |
| `tf-backend-webgl.min.js` | 390 KB | execução na GPU |
| `tf-backend-cpu.min.js` | 129 KB | reserva para aparelhos sem WebGL utilizável |
| `blazeface.min.umd.js` | 11 KB | detector de rosto (`@tensorflow-models/blazeface`) |

Os pacotes são avulsos, e não o guarda-chuva `@tensorflow/tfjs`, que traria
junto o `tfjs-layers` — grande e sem uso aqui. Em troca, os métodos
encadeados de tensor (`t.div(255)`) não existem: use a API funcional
(`tf.div(t, 255)`).

Para atualizar:

```
npm pack @tensorflow/tfjs-core @tensorflow/tfjs-converter \
         @tensorflow/tfjs-backend-webgl @tensorflow/tfjs-backend-cpu
```

e copie os `dist/*.min.js` de cada pacote para cá.

## Selfie Segmentation — `../../models/segmentacao/`

Modelo do MediaPipe (Google), licença Apache 2.0, em formato TensorFlow.js
(`model.json` + 208 KB de pesos). Recebe a imagem em 256×256 e devolve, para
cada pixel, a probabilidade de ser pessoa.

Origem: `https://tfhub.dev/mediapipe/tfjs-model/selfie_segmentation/general/1`

## BlazeFace — `../../models/rosto/`

Detector de rosto do Google, licença Apache 2.0, em formato TensorFlow.js
(`model.json` + 392 KB de pesos). Devolve a caixa de cada rosto da imagem.

É dele que sai a escala da montagem: o recorte de quem envia a foto é
montado em múltiplos da caixa do rosto, e os seis recortes do Yasser foram
medidos com o mesmo detector. Trocar os recortes do Yasser exige remedi-los
e atualizar `ROSTO_ACIMA` e `ROSTO_ABAIXO` em `js/foto-com-yasser.js`.

Origem: `https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1`
