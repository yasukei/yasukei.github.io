<script setup>
import BrowserInfo from '../components/BrowserInfo.vue'
</script>

# ブラウザから読み取れる情報

どのWebページも、許可ダイアログを一切出さずに JavaScript だけでここまで読み取れる、という一覧です。
各項目の下にあるコードを他のサイトの開発者ツールのコンソールに貼り付ければ、同じ値が取れます。

このページは静的なサイトで、ここに表示した情報はどこにも送信していません。

## ブラウザ・OS

<BrowserInfo category="browser" />

## ハードウェア

GPUの機種や、描画・音声処理の結果に出るわずかな差は、Cookieを消しても変わらないので、ブラウザフィンガープリント(端末の識別)によく使われます。

<BrowserInfo category="hardware" />

## インストール環境

何が入っているかは、OSや言語だけでなく、使っているソフトや仕事の見当まで付けられる材料になります。

<BrowserInfo category="install" />
