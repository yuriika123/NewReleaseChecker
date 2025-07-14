// iTunes APIを使用（認証不要）
const albumListDiv = document.querySelector('#album-list');

// 新しいボタンをscript.jsの上の方で取得しておく
const checkAllButton = document.querySelector('#check-all-button');

// アーティストを検索して「アーティストID」を返す関数
async function searchArtist(artistName) {
  try {
    console.log('検索ワード:', artistName);
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=artist&limit=1`;
    console.log('iTunes APIリクエストURL:', url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('iTunes APIレスポンス:', data);

    if (data.results && data.results.length > 0) {
      return data.results[0].artistId;
    } else {
      return null;
    }
  } catch (error) {
    console.error('アーティスト検索でエラー:', error);
    throw error;
  }
}

// アーティストIDを使って「アルバムのリスト」を返す関数
async function getArtistAlbums(artistId) {
  if (!artistId) return []; // IDがなければ空の配列を返す

  try {
    console.log('アルバム取得中、アーティストID:', artistId);
    const response = await fetch(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=50`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('アルバム取得レスポンス:', data);
    
    // iTunes APIのレスポンス形式に合わせて処理
    if (data.results && data.results.length > 1) {
      // 最初の要素はアーティスト情報なので除外し、アルバムのみを返す
      return data.results.slice(1);
    }
    return [];
  } catch (error) {
    console.error('アルバム取得でエラー:', error);
    throw error;
  }
}

// 「アルバムのリスト」を受け取って画面に表示する関数
function displayAlbums(albums) {
  albumListDiv.innerHTML = ''; // まずは表示エリアを空っぽにする

  for (const album of albums) {
    const albumInfo = document.createElement('p');
    // iTunes APIのレスポンス形式に合わせて表示
    const releaseDate = new Date(album.releaseDate).toLocaleDateString('ja-JP');
    albumInfo.textContent = `💿 ${album.collectionName} / ${album.artistName} (${releaseDate})`;

    const albumImage = document.createElement('img');
    albumImage.src = album.artworkUrl100.replace('100x100', '200x200'); // 画像サイズを大きくする
    albumImage.width = 200;

    albumListDiv.appendChild(albumImage);
    albumListDiv.appendChild(albumInfo);
  }
}

// HTMLの要素を取得して、変数に入れる
const input = document.querySelector('#artist-input');
const button = document.querySelector('#add-button');
const artistList = document.querySelector('#artist-list');

// Apple MusicアーティストURLからIDを抽出する関数
function extractArtistIdFromUrl(url) {
  // 例: https://music.apple.com/jp/artist/インナージャーニー/1500537939
  const match = url.match(/artist\/[^/]+\/(\d+)/);
  return match ? match[1] : null;
}

// artists配列の構造を { id, name } のオブジェクト配列に変更
const artists = JSON.parse(localStorage.getItem('artists')) || [];

// 最初にlocalStorageのデータからリストを復元する関数
function renderArtists() {
    artistList.innerHTML = '';
    for (const artist of artists) {
        const li = document.createElement('li');
        li.textContent = `${artist.name}（ID: ${artist.id}）`;

        const deleteButton = document.createElement('button');
        deleteButton.textContent = '削除';
        deleteButton.addEventListener('click', () => {
            const idx = artists.findIndex(a => a.id === artist.id);
            if (idx !== -1) {
                artists.splice(idx, 1);
                saveArtists();
                renderArtists();
            }
        });
        li.appendChild(deleteButton);
        artistList.appendChild(li);
    }
}

function saveArtists() {
    localStorage.setItem('artists', JSON.stringify(artists));
}

// Apple MusicアーティストURLから登録する処理
button.addEventListener('click', async () => {
  const inputValue = input.value.trim();
  if (inputValue === '') return;

  const artistId = extractArtistIdFromUrl(inputValue);
  if (!artistId) {
    albumListDiv.innerHTML = '<p>Apple MusicのアーティストURLを入力してください。</p>';
    return;
  }

  // すでに登録済みかチェック
  if (artists.some(a => a.id === artistId)) {
    albumListDiv.innerHTML = '<p>このアーティストはすでに登録されています。</p>';
    return;
  }

  try {
    // アーティスト情報取得
    const response = await fetch(`https://itunes.apple.com/lookup?id=${artistId}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      albumListDiv.innerHTML = '<p>アーティスト情報が取得できませんでした。</p>';
      return;
    }
    const artistName = data.results[0].artistName;
    // artists配列に追加
    artists.push({ id: artistId, name: artistName });
    saveArtists();
    renderArtists();
    albumListDiv.innerHTML = `<p>${artistName} を登録しました。</p>`;
    input.value = '';
  } catch (error) {
    albumListDiv.innerHTML = `<p>エラーが発生しました: ${error.message}</p>`;
  }
});

// 登録済みアーティスト全員の新譜をチェックするメインの関数
async function checkAllNewReleases() {
  albumListDiv.innerHTML = '<p>チェック中...</p>';
  let allAlbums = [];
  for (const artist of artists) {
    try {
      const response = await fetch(`https://itunes.apple.com/lookup?id=${artist.id}&entity=album&limit=50`);
      if (!response.ok) continue;
      const data = await response.json();
      if (data.results && data.results.length > 1) {
        allAlbums = allAlbums.concat(data.results.slice(1));
      }
    } catch (e) {}
  }
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const recentAlbums = allAlbums.filter(album => new Date(album.releaseDate) >= oneMonthAgo);
  const uniqueAlbums = [...new Map(recentAlbums.map(item => [item['collectionId'], item])).values()];
  const sortedAlbums = uniqueAlbums.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
  displayAlbums(sortedAlbums);
  if (sortedAlbums.length === 0) {
    albumListDiv.innerHTML = '<p>過去1ヶ月の新譜は見つかりませんでした。</p>';
  }
}

// displayAlbums関数はそのまま利用
// Enterキーでも登録できるようにする
input.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    button.click();
  }
});

// 初期化
renderArtists();
checkAllButton.addEventListener('click', checkAllNewReleases);