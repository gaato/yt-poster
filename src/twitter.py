import io
import logging
from typing import Optional

import requests
import tweepy

logger = logging.getLogger(__name__)


class TwitterPoster:
    def __init__(
        self,
        consumer_key: str,
        consumer_secret: str,
        access_token: str,
        access_token_secret: str,
    ) -> None:
        """
        Initializes the TwitterPoster.

        Args:
            consumer_key: The consumer key for the Twitter API.
            consumer_secret: The consumer secret for the Twitter API.
            access_token: The access token for the Twitter API.
            access_token_secret: The access token secret for the Twitter API.
        """
        try:
            self.auth = tweepy.OAuthHandler(consumer_key, consumer_secret)
            self.auth.set_access_token(access_token, access_token_secret)
            self.api = tweepy.API(self.auth)
            self.client = tweepy.Client(
                consumer_key=consumer_key,
                consumer_secret=consumer_secret,
                access_token=access_token,
                access_token_secret=access_token_secret,
            )
            logger.info("TwitterPoster initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize TwitterPoster: {e}")
            raise e

    def media_upload(self, url: str) -> Optional[str]:
        """
        Uploads media from URL to Twitter.
        
        Args:
            url: URL of the media to upload
            
        Returns:
            Media ID if successful, None otherwise
        """
        try:
            with requests.get(url, timeout=30) as r:
                r.raise_for_status()
                file = io.BytesIO(r.content)
                filename = url.split("/")[-1]

            media = self.api.media_upload(file=file, filename=filename)
            logger.info(f"Media uploaded successfully: {media.media_id}")
            return media.media_id
            
        except Exception as e:
            logger.error(f"Failed to upload media from {url}: {e}")
            return None

    def post_tweet(
        self,
        text: str,
        media_ids: list[str] = [],
        reply_to: Optional[str | int] = None,
    ) -> Optional[tweepy.Response]:
        """
        Posts a tweet with specified text and media IDs.

        Args:
            text: The text of the tweet.
            media_ids: List of media IDs to attach to the tweet.
            reply_to: The ID of the tweet to reply to.

        Returns:
            Tweet response if successful, None otherwise.
        """
        try:
            # Filter out None media IDs
            valid_media_ids = [mid for mid in media_ids if mid is not None]
            
            result = self.client.create_tweet(
                text=text, 
                media_ids=valid_media_ids if valid_media_ids else None,
                in_reply_to_tweet_id=reply_to
            )
            logger.info(f"Tweet posted successfully: {text[:50]}...")
            return result
            
        except Exception as e:
            logger.error(f"Failed to post tweet: {e}")
            return None
