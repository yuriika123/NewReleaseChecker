// Spotifyの認証情報（ユーザー入力から設定）
let spotifyClientId = '';
let spotifyClientSecret = '';
let accessToken = ''; // アクセストークンを保存する変数

// モーダル要素
const spotifyAuthModal = document.getElementById('spotify-auth-modal');
const clientIdInput = document.getElementById('client-id-input');
const clientSecretInput = document.getElementById('client-secret-input');
const saveCredentialsButton = document.getElementById('save-credentials');
const settingsButton = document.getElementById('settings-button');

const albumListDiv = document.querySelector('#album-list');
const checkAllButton = document.querySelector('#check-all-button');
const artistCountElement = document.querySelector('#artist-count');

async function getAccessToken() {
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(spotifyClientId + ':' + spotifyClientSecret)
            },
            body: 'grant_type=client_credentials'
        });

        const data = await response.json();
        console.log('取得したアクセストークン:', data.access_token);
        accessToken = data.access_token;
    } catch (error) {
        console.error('アクセストークンの取得に失敗しました:', error);
    }
}

// アーティストを検索して「アーティストID」を返す関数
async function searchArtist(artistName) {
    if (!accessToken) return null;

    try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const data = await response.json();

        if (data.artists.items.length > 0) {
            return data.artists.items[0].id;
        } else {
            return null;
        }
    } catch (error) {
        console.error('アーティスト検索に失敗しました:', error);
        return null;
    }
}

// アーティストIDを使って「アルバムのリスト」を返す関数
async function getArtistAlbums(artistId) {
    if (!accessToken || !artistId) return [];

    try {
        const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?market=JP&limit=50`, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const data = await response.json();
        return data.items || [];
    } catch (error) {
        console.error('アルバム取得に失敗しました:', error);
        return [];
    }
}

// ローディング状態を表示する関数
function showLoading() {
    albumListDiv.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <span>チェック中...</span>
        </div>
    `;
}

// エラー状態を表示する関数
function showError(message) {
    albumListDiv.innerHTML = `
        <div class="empty-state">
            <p>❌ ${message}</p>
        </div>
    `;
}

// 空の状態を表示する関数
function showEmpty() {
    albumListDiv.innerHTML = `
        <div class="empty-state">
            <p>📭 過去1ヶ月の新譜は見つかりませんでした。</p>
        </div>
    `;
}

// 「アルバムのリスト」を受け取って画面に表示する関数
function displayAlbums(albums) {
    if (!albums || albums.length === 0) {
        showEmpty();
        return;
    }

    albumListDiv.innerHTML = '';

    albums.forEach(album => {
        const albumCard = document.createElement('div');
        albumCard.className = 'album-card';

        const albumImage = document.createElement('img');
        albumImage.className = 'album-image';
        albumImage.src = album.images[0]?.url || '';
        albumImage.alt = `${album.name} のアルバムカバー`;
        albumImage.onerror = function() {
            this.style.display = 'none';
        };

        const albumInfo = document.createElement('div');
        albumInfo.className = 'album-info';

        const albumTitle = document.createElement('div');
        albumTitle.className = 'album-title';
        albumTitle.textContent = album.name;

        const albumArtist = document.createElement('div');
        albumArtist.className = 'album-artist';
        albumArtist.textContent = album.artists[0].name;

        const albumDate = document.createElement('div');
        albumDate.className = 'album-date';
        albumDate.textContent = formatDate(album.release_date);

        albumInfo.appendChild(albumTitle);
        albumInfo.appendChild(albumArtist);
        albumInfo.appendChild(albumDate);

        albumCard.appendChild(albumImage);
        albumCard.appendChild(albumInfo);

        albumListDiv.appendChild(albumCard);
    });
}

// 日付をフォーマットする関数
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// HTMLの要素を取得して、変数に入れる
const input = document.querySelector('#artist-input');
const button = document.querySelector('#add-button');
const artistList = document.querySelector('#artist-list');

// artistsという配列を用意。localStorageにあればそれを、なければ空の配列を使う
const artists = JSON.parse(localStorage.getItem('artists')) || [];

// アーティストカウンターを更新する関数
function updateArtistCount() {
    artistCountElement.textContent = `${artists.length}人`;
}

// 最初にlocalStorageのデータからリストを復元する関数
function renderArtists() {
    artistList.innerHTML = '';
    
    if (artists.length === 0) {
        artistList.innerHTML = `
            <div class="empty-state">
                <p>📝 アーティストを登録してください</p>
            </div>
        `;
        updateArtistCount();
        return;
    }

    artists.forEach(artist => {
        const li = document.createElement('li');
        li.className = 'artist-item';

        const artistName = document.createElement('span');
        artistName.className = 'artist-name';
        artistName.textContent = artist;

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-danger';
        deleteButton.textContent = '削除';

        deleteButton.addEventListener('click', () => {
            artists.splice(artists.indexOf(artist), 1);
            saveArtists();
            renderArtists();
        });

        li.appendChild(artistName);
        li.appendChild(deleteButton);
        artistList.appendChild(li);
    });
    
    updateArtistCount();
}

// データをlocalStorageに保存する機能
function saveArtists() {
    localStorage.setItem('artists', JSON.stringify(artists));
}

// ボタンがクリックされた時の処理
button.addEventListener('click', async () => {
    if (input.value.trim() === '') return;

    const artistName = input.value.trim();
    
    // 既に登録されているかチェック
    if (artists.includes(artistName)) {
        showError(`${artistName} は既に登録されています。`);
        return;
    }

    showLoading();

    try {
        const artistId = await searchArtist(artistName);
        if (artistId) {
            const albums = await getArtistAlbums(artistId);
            displayAlbums(albums);
        } else {
            showError(`${artistName} は見つかりませんでした。`);
            return;
        }

        artists.push(artistName);
        saveArtists();
        renderArtists();
        input.value = '';
    } catch (error) {
        console.error('エラーが発生しました:', error);
        showError('エラーが発生しました。もう一度お試しください。');
    }
});

// Enterキーでも登録できるようにする
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        button.click();
    }
});

// 登録済みアーティスト全員の新譜をチェックするメインの関数
async function checkAllNewReleases() {
    if (artists.length === 0) {
        showError('登録されているアーティストがいません。');
        return;
    }

    console.log('新譜のチェックを開始します...');
    showLoading();

    try {
        let allAlbums = [];

        // 1. 登録済みのアーティストを一人ずつ処理
        for (const artistName of artists) {
            const artistId = await searchArtist(artistName);
            if (artistId) {
                const albums = await getArtistAlbums(artistId);
                allAlbums = allAlbums.concat(albums);
            }
        }

        // 2. 過去1ヶ月以内にリリースされたものだけに絞り込む
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const recentAlbums = allAlbums.filter(album => {
            return album.release_date_precision === 'day' && new Date(album.release_date) >= oneMonthAgo;
        });

        // 3. 重複しているアルバムを削除する
        const uniqueAlbums = [...new Map(recentAlbums.map(item => [item['id'], item])).values()];
        
        // 4. リリース日が新しい順に並び替える
        const sortedAlbums = uniqueAlbums.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

        console.log('最終的なアルバムリスト:', sortedAlbums);
        displayAlbums(sortedAlbums);
    } catch (error) {
        console.error('新譜チェック中にエラーが発生しました:', error);
        showError('新譜のチェック中にエラーが発生しました。もう一度お試しください。');
    }
}

// モーダル関連の機能
function showSpotifyAuthModal() {
    spotifyAuthModal.classList.add('show');
    clientIdInput.focus();
}

function hideSpotifyAuthModal() {
    spotifyAuthModal.classList.remove('show');
}

function saveSpotifyCredentials() {
    const clientId = clientIdInput.value.trim();
    const clientSecret = clientSecretInput.value.trim();
    
    if (!clientId || !clientSecret) {
        alert('Client IDとClient Secretを両方入力してください。');
        return;
    }
    
    spotifyClientId = clientId;
    spotifyClientSecret = clientSecret;
    
    // 認証情報をlocalStorageに保存（オプション）
    localStorage.setItem('spotifyClientId', clientId);
    localStorage.setItem('spotifyClientSecret', clientSecret);
    
    hideSpotifyAuthModal();
    
    // アクセストークンを取得
    getAccessToken();
}

// 保存ボタンのイベントリスナー
saveCredentialsButton.addEventListener('click', saveSpotifyCredentials);

// 設定ボタンのイベントリスナー
settingsButton.addEventListener('click', () => {
    // 現在の認証情報を入力フィールドに設定
    clientIdInput.value = spotifyClientId;
    clientSecretInput.value = spotifyClientSecret;
    showSpotifyAuthModal();
});

// Enterキーでも保存できるようにする
clientIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        clientSecretInput.focus();
    }
});

clientSecretInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveSpotifyCredentials();
    }
});

// ページ読み込み時の処理
function initializeApp() {
    // 保存された認証情報があるかチェック
    const savedClientId = localStorage.getItem('spotifyClientId');
    const savedClientSecret = localStorage.getItem('spotifyClientSecret');
    
    if (savedClientId && savedClientSecret) {
        spotifyClientId = savedClientId;
        spotifyClientSecret = savedClientSecret;
        getAccessToken();
    } else {
        // 認証情報がない場合はモーダルを表示
        showSpotifyAuthModal();
    }
    
    // 画面を描画
    renderArtists();
}

// 最初に画面を描画
initializeApp();

checkAllButton.addEventListener('click', checkAllNewReleases);