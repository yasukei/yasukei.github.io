<script setup>
import BrowserInfo from '../components/BrowserInfo.vue'
</script>

# ブラウザから読み取れる情報

どのWebページも、許可ダイアログを一切出さずに JavaScript だけでここまで読み取れる、という一覧です。
各項目の下にあるコードを他のサイトの開発者ツールのコンソールに貼り付ければ、同じ値が取れます。

このページは静的なサイトで、ここに表示した情報はどこにも送信していません。

<BrowserInfo />
