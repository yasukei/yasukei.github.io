<script setup>
import BrowserInfo from '../components/BrowserInfo.vue'
import BehaviorTracker from '../components/BehaviorTracker.vue'
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

## ウィンドウとページの状態

ウィンドウの大きさや位置、いま見られているかどうかは、ページを開いている間ずっと読み取れます。

<BrowserInfo category="page" />

## 操作の情報 (行動データ)

このページを開いた瞬間から、マウス、スクロール、キー入力などをページ自身が記録しています(ここでは表示しているだけで、どこにも送っていません)。
マウスの動きやキー入力のリズムには人ごとの癖があるため、ボット検知だけでなく本人の識別(行動バイオメトリクス)にも使われています。

<BehaviorTracker />
