<AvatarCard
  key={avatar.id}
  avatar={avatar}
  onUse={handleUseAvatar}
  onDelete={handleDeleteAvatar}
/>
                ))}
              </div >
            )}
          </div >
        </FadeInView >
      </SignedIn >
    </div >
  );
};

export default AvatarsScreen;
